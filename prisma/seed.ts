import { PrismaClient, Market } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.log("Skipping seed in production");
    return;
  }

  const email = process.env.DEV_USER_EMAIL ?? "founder@local.dev";
  const password = process.env.DEV_USER_PASSWORD ?? "changeme123";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Dev user ${email} already exists`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName: "Founder",
      primaryMarket: Market.BOTH,
    },
  });

  console.log(`Created dev user: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
