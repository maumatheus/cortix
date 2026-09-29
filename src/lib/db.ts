import { PrismaClient } from "@prisma/client";

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // tokens OAuth das redes nunca saem nas consultas por padrão (evita vazar pra API/MCP);
    // quem precisa deles pede com `omit: { accessToken: false, refreshToken: false }`
    omit: { socialAccount: { accessToken: true, refreshToken: true } },
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
