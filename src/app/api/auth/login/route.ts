import { ApiError, handle, ok, parseJson } from "@/lib/api";
import { setUserCookie, toSafeUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LoginSchema } from "@/lib/validation/auth";

export const POST = handle(async (req: Request) => {
  const body = await parseJson(req, LoginSchema);

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  // Single generic message whether the email or password is wrong — avoids
  // leaking which accounts exist.
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    throw new ApiError(
      "Invalid email or password.",
      401,
      "INVALID_CREDENTIALS",
    );
  }

  setUserCookie(user.id);
  return ok({ user: toSafeUser(user) });
});
