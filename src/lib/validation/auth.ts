import { z } from "zod";

// Mirrors the Prisma enum. Hand-written here so client bundles don't need to
// import the Prisma client (which is server-only).
export const MarketEnum = z.enum(["FOREX", "CRYPTO", "BOTH"]);
export type MarketInput = z.infer<typeof MarketEnum>;

const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long");

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(5)
  .max(254)
  .email("Invalid email address");

export const SignupSchema = z.object({
  email: emailField,
  password: passwordField,
  displayName: z.string().trim().min(1).max(64).optional(),
  primaryMarket: MarketEnum.optional(),
});
export type SignupInput = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({
  email: emailField,
  // On login we only require non-empty — historical accounts may have had
  // weaker rules. Length cap stays as a sanity check.
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof LoginSchema>;
