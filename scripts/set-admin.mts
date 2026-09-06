// One-off maintenance script — grants (or revokes) admin panel access by email.
// Usage: npx tsx scripts/set-admin.mts you@gmail.com [--revoke]
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const email = process.argv[2];
const revoke = process.argv.includes("--revoke");

if (!email) {
  console.error("Usage: npx tsx scripts/set-admin.mts you@gmail.com [--revoke]");
  process.exit(1);
}

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || "file:./data/app.db" });
const prisma = new PrismaClient({ adapter });

const user = await prisma.user.findUnique({ where: { email } });
if (!user) {
  console.error(`User with email "${email}" not found — they need to log in at least once first.`);
  process.exit(1);
}

await prisma.user.update({ where: { email }, data: { isAdmin: !revoke } });
console.log(`${email} is now ${revoke ? "NOT an admin" : "an admin"}.`);
await prisma.$disconnect();
