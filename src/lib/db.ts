import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  // WMC225_DATABASE_URL memungkinkan test E2E memakai database terisolasi
  // tanpa menimpa DATABASE_URL milik .env.local.
  const datasourceUrl = process.env.WMC225_DATABASE_URL || undefined;
  return new PrismaClient({
    datasourceUrl,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
