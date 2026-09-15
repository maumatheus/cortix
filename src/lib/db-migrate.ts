import { db } from "./db";

/**
 * Migracoes leves para o SQLite do app desktop, onde nao da pra rodar `prisma db push`
 * a cada atualizacao. Cada entrada e idempotente: so adiciona a coluna se ela nao existir.
 * Ao criar uma coluna nova no schema.prisma, registre aqui tambem.
 */
const COLUNAS: Array<{ table: string; column: string; ddl: string }> = [
  { table: "Project", column: "effects", ddl: `ALTER TABLE "Project" ADD COLUMN "effects" TEXT NOT NULL DEFAULT '{}'` },
  { table: "Short", column: "effects", ddl: `ALTER TABLE "Short" ADD COLUMN "effects" TEXT` },
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
}
