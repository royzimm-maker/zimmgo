import { PrismaClient } from "@prisma/client";

// Standard Next.js singleton — without this, every hot-reload in dev would
// create a fresh PrismaClient (and a fresh DB connection) on top of the last.
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
