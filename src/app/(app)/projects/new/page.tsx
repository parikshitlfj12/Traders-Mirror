import type { Metadata } from "next";
import Link from "next/link";

import { NewProjectForm } from "@/components/projects/NewProjectForm";
import { requirePageUser } from "@/lib/auth";

export const metadata: Metadata = { title: "New project" };

export const dynamic = "force-dynamic";

// =============================================================================
// /projects/new — project creator (PRD §11.2.3).
//
// Server wrapper. Gates on auth, renders the client form. The breadcrumb
// link back to /projects exists so the user has a quick escape hatch if they
// landed here by mistake — there's no "cancel and go back" gesture on the
// form itself beyond the explicit button.
// =============================================================================

export default async function NewProjectPage() {
  await requirePageUser();

  return (
    <section className="flex w-full flex-1 flex-col gap-5 py-2">
      <nav className="text-xs text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">
          ← Projects
        </Link>
      </nav>
      <NewProjectForm />
    </section>
  );
}
