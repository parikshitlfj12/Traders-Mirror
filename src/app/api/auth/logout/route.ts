import { handle, ok } from "@/lib/api";
import { clearUserCookie } from "@/lib/auth";

export const POST = handle(async () => {
  clearUserCookie();
  return ok({ ok: true });
});
