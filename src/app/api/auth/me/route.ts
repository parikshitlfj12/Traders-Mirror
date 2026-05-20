import { handle, ok } from "@/lib/api";
import { requireUser, toSafeUser } from "@/lib/auth";

// Cookies make this inherently per-request; opt out of static analysis.
export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const user = await requireUser();
  return ok({ user: toSafeUser(user) });
});
