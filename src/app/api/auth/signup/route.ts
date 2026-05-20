import { ApiError, handle, ok, parseJson } from "@/lib/api";
import { hashPassword, setUserCookie, toSafeUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SignupSchema } from "@/lib/validation/auth";

export const POST = handle(async (req: Request) => {
  const body = await parseJson(req, SignupSchema);

  const existing = await prisma.user.findUnique({
    where: { email: body.email },
    select: { id: true },
  });
  if (existing) {
    throw new ApiError("That email is already in use.", 409, "EMAIL_TAKEN");
  }

  const user = await prisma.user.create({
    data: {
      email: body.email,
      passwordHash: await hashPassword(body.password),
      displayName: body.displayName ?? null,
      primaryMarket: body.primaryMarket ?? "CRYPTO",
    },
  });

  setUserCookie(user.id);
  return ok({ user: toSafeUser(user) }, { status: 201 });
});
