import { Prisma } from "@prisma/client";

import { getAIProvider, type ParseRulesResult } from "@/lib/ai";
import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { checkBudget } from "@/lib/budget";
import { prisma } from "@/lib/prisma";
import {
  projectFullSelect,
  toProjectListItem,
} from "@/lib/projects/serializer";
import {
  insertParsedRules,
  logParseRulesUsage,
  type RuleView,
} from "@/lib/rules";
import { ProjectCreateSchema } from "@/lib/validation/projects";

// =============================================================================
// /api/projects (PRD §9.2)
//
//   GET  ?active=1   → list this user's projects, optionally only active ones,
//                      each with a precomputed financial status snapshot for
//                      the list view's mini-strip.
//   POST             → create a new project. Stage 1 stores rawText verbatim;
//                      Stage 2 will run it through provider.parseRules at
//                      this point and seed Rule rows in the same transaction.
//
// Always scoped to the authenticated user. Returned shape lives under
// `data.projects` (list) / `data.project` (single) to keep the envelope
// consistent with the rest of the app.
// =============================================================================

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const activeOnly = url.searchParams.get("active") === "1";

  const projects = await prisma.project.findMany({
    where: {
      userId: user.id,
      ...(activeOnly ? { isActive: true } : {}),
    },
    // Active first, then most recently updated. Mirrors the list page's
    // "active pinned to top" rule from PRD §11.2.
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    select: projectFullSelect,
  });

  return ok({
    projects: projects.map((p) => toProjectListItem(p, user.timezone)),
  });
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const input = await parseJson(req, ProjectCreateSchema);

  // Decimal columns: pass Prisma.Decimal — Prisma serialises losslessly into
  // MySQL Decimal(18,2). Using `new Prisma.Decimal(...)` avoids floating-
  // point silently dropping the cents on edge values like 1.005.
  //
  // The project row + AI-parsed Rule rows are committed in the same Prisma
  // transaction. If parsing fails or the budget gate trips, the project
  // still gets created with `rulesParseSkipped` flagged on the response so
  // the UI can prompt the user to retry from the detail page.

  const trimmedRawText = input.rawText.trim();
  const parseAttempt =
    trimmedRawText.length > 0
      ? await tryParseRulesForCreate({
          userId: user.id,
          rawText: trimmedRawText,
          primaryMarket: user.primaryMarket,
        })
      : { kind: "skipped" as const, reason: "no_raw_text" as const };

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        userId: user.id,
        name: input.name,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        startingCapital: new Prisma.Decimal(input.startingCapital),
        maxDrawdown: new Prisma.Decimal(input.maxDrawdown),
        dailyDrawdown: new Prisma.Decimal(input.dailyDrawdown),
        profitTarget: new Prisma.Decimal(input.profitTarget),
        rawText: input.rawText,
        isActive: true,
      },
      select: projectFullSelect,
    });

    let rules: RuleView[] = [];
    if (parseAttempt.kind === "ok" && parseAttempt.result.rules.length > 0) {
      rules = await insertParsedRules(
        tx,
        created.id,
        parseAttempt.result.rules,
      );
    }
    return { created, rules };
  });

  // Log AI usage AFTER the transaction succeeds — we don't want to charge
  // budget for a parse that ultimately rolled back with the project create.
  // The `parse_rules` operation carries no `voiceNoteId` per PRD §5
  // (general-purpose ledger).
  if (parseAttempt.kind === "ok") {
    await logParseRulesUsage({
      userId: user.id,
      provider: parseAttempt.result.provider,
      model: parseAttempt.result.model,
      inputTokens: parseAttempt.result.inputTokens,
      outputTokens: parseAttempt.result.outputTokens,
      estimatedCostUsd: parseAttempt.result.estimatedCostUsd,
    });
  }

  return ok(
    {
      project: toProjectListItem(project.created, user.timezone),
      rules: project.rules,
      // Surface why parsing didn't seed any rules so the client can show a
      // hint rather than leaving the user wondering. "ok" with zero rules
      // happens when the model decided nothing was parseable.
      rulesParse:
        parseAttempt.kind === "ok"
          ? ({ status: "ok", count: project.rules.length } as const)
          : ({ status: "skipped", reason: parseAttempt.reason } as const),
    },
    { status: 201 },
  );
});

// -----------------------------------------------------------------------------
// AI parsing helper.
//
// Wrapped so the create handler stays linear. Three legitimate outcomes:
//   - ok       : parsing succeeded; rules ready to seed.
//   - skipped  : budget exhausted OR provider doesn't support parseRules
//                OR raw text was empty. Project still gets created.
//   - skipped  : provider threw — we log the error and treat it like
//                budget-exceeded so the user isn't blocked from creating.
// -----------------------------------------------------------------------------

type ParseAttempt =
  | { kind: "ok"; result: ParseRulesResult }
  | { kind: "skipped"; reason: "budget_exceeded" | "provider_error" | "no_parser" | "no_raw_text" };

async function tryParseRulesForCreate(args: {
  userId: string;
  rawText: string;
  primaryMarket: "FOREX" | "CRYPTO" | "BOTH";
}): Promise<ParseAttempt> {
  const budget = await checkBudget(args.userId);
  if (!budget.allowed) {
    return { kind: "skipped", reason: "budget_exceeded" };
  }

  const provider = getAIProvider();
  if (!provider.parseRules) {
    return { kind: "skipped", reason: "no_parser" };
  }

  try {
    const result = await provider.parseRules({
      userId: args.userId,
      rawText: args.rawText,
      primaryMarket: args.primaryMarket,
    });
    return { kind: "ok", result };
  } catch (e) {
    // Never fail project creation on parse failure — surface the cause via
    // the response flag and let the user retry from the rule editor.
    console.error("[projects/create] parseRules failed", e);
    return { kind: "skipped", reason: "provider_error" };
  }
}
