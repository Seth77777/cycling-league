import { PrismaClient } from "@/generated/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

function createPrisma() {
  // In production (Vercel), the local file is not writable/persistent — use Turso instead.
  const adapter = process.env.TURSO_DATABASE_URL
    ? new PrismaLibSql({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
    : new PrismaBetterSqlite3({ url: path.resolve(process.cwd(), "dev.db") });
  return new PrismaClient({ adapter });
}

type PrismaInstance = ReturnType<typeof createPrisma>;
const globalForPrisma = global as unknown as { prisma: PrismaInstance };
export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
