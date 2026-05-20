import { cookies } from "next/headers";
import bcrypt from "bcrypt";
import type { User } from "@prisma/client";
import { prisma } from "./prisma";

// =============================================================================
// Auth helpers — the single home for ALL auth logic (PRD §4 decision #7, §8.2).
// Routes never read cookies directly; they call getCurrentUser/requireUser.
// =============================================================================

const COOKIE_NAME = "userId";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// `cookies()` is synchronous in Next.js 14.2; PRD §8.2 shows the Next.js 15
// async form. Swap to `await cookies()` when upgrading to Next 15.
export function setUserCookie(userId: string): void {
  cookies().set(COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export function clearUserCookie(): void {
  cookies().delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<User | null> {
  const userId = cookies().get(COOKIE_NAME)?.value;
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

// Never serialise the passwordHash. Use this whenever returning a user from
// an API route or rendering it into a server component prop.
export type SafeUser = Omit<User, "passwordHash">;

export function toSafeUser(user: User): SafeUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}
