import { db } from "./db";

/**
 * Migracoes leves para o SQLite do app desktop, onde nao da pra rodar `prisma db push`
 * a cada atualizacao. Cada entrada e idempotente: so adiciona a coluna se ela nao existir.
 * Ao criar uma coluna nova no schema.prisma, registre aqui tambem.
 */
const COLUNAS: Array<{ table: string; column: string; ddl: string }> = [
  { table: "Project", column: "effects", ddl: `ALTER TABLE "Project" ADD COLUMN "effects" TEXT NOT NULL DEFAULT '{}'` },
  { table: "Short", column: "effects", ddl: `ALTER TABLE "Short" ADD COLUMN "effects" TEXT` },
  { table: "User", column: "licenseCheckedAt", ddl: `ALTER TABLE "User" ADD COLUMN "licenseCheckedAt" DATETIME` },
  { table: "User", column: "licenseExpiresAt", ddl: `ALTER TABLE "User" ADD COLUMN "licenseExpiresAt" DATETIME` },
];

export async function migrateSqlite() {
  if (!(process.env.DATABASE_URL || "").startsWith("file:")) return;
  for (const c of COLUNAS) {
    try {
      const cols = (await db.$queryRawUnsafe(`PRAGMA table_info("${c.table}")`)) as Array<{ name: string }>;
      if (!cols.length || cols.some((x) => x.name === c.column)) continue;
      await db.$executeRawUnsafe(c.ddl);
      console.log(`[db] coluna ${c.table}.${c.column} criada`);
    } catch (e) {
      console.error(`[db] migracao ${c.table}.${c.column} falhou:`, (e as Error).message);
    }
  }
  await ensureDesktopAdmin();
}

/**
 * Conta local do app desktop (admin / 12345), igual ao scripts/criar-admin.ts.
 * So existe em builds SEM servidor de licencas (desenvolvimento): com CORTIX_LICENSE_URL
 * configurado, quem decide quem entra e o servidor. Nunca roda no site publico e SO cria:
 * se a conta ja existe, a senha atual e preservada.
 */
async function ensureDesktopAdmin() {
  if (process.env.CORTIX_DESKTOP !== "1") return;
  if (process.env.CORTIX_LICENSE_URL) return;
  try {
    const existente = await db.user.findUnique({ where: { email: "admin" }, select: { id: true } });
    if (existente) return;
    const [{ default: bcrypt }, { ulid }] = await Promise.all([import("bcryptjs"), import("ulid")]);
    await db.user.create({
      data: {
        id: ulid(),
        name: "Admin",
        email: "admin",
        passwordHash: await bcrypt.hash("12345", 10),
        credits: 5000,
        referralCode: `ADMIN${ulid().slice(-6)}`,
        plan: "viral",
        planCycle: "yearly",
        planRenewsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    console.log("[db] conta local admin criada");
  } catch (e) {
    console.error("[db] nao foi possivel criar a conta admin:", (e as Error).message);
  }
}
