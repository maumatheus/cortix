// Importa projetos e cortes do banco que veio do outro PC, sem apagar o que ja existe aqui.
// Reescreve os caminhos absolutos do outro PC para os desta maquina.
// Uso (uma vez): node importar-do-outro-pc.mjs
import { PrismaClient } from "@prisma/client";
import path from "node:path";

const ORIGEM = "file:C:/Users/rafas/Documents/cortix-import/cortix/prisma/dev.db";
const RAIZ_ANTIGA = /C:\\Users\\MATHEUS HACK\\Desktop\\cortix/gi;
const RAIZ_NOVA = path.resolve(process.cwd());

const de = new PrismaClient({ datasources: { db: { url: ORIGEM } } });
const para = new PrismaClient();

const arrumaCaminho = (v) => (typeof v === "string" ? v.replace(RAIZ_ANTIGA, RAIZ_NOVA) : v);

// o dono de tudo passa a ser a conta local "admin"
const dono = await para.user.findUnique({ where: { email: "admin" } });
if (!dono) throw new Error('Conta local "admin" nao existe. Rode: npx tsx scripts/criar-admin.ts');

const projetos = await de.project.findMany({ orderBy: { createdAt: "asc" } });
let novos = 0;
let pulados = 0;

for (const p of projetos) {
  if (await para.project.findUnique({ where: { id: p.id } })) {
    pulados++;
    console.log("  ja existia, pulando:", p.id);
    continue;
  }
  await para.project.create({
    data: { ...p, userId: dono.id, sourcePath: arrumaCaminho(p.sourcePath), thumbnailUrl: arrumaCaminho(p.thumbnailUrl) },
  });
  const shorts = await de.short.findMany({ where: { projectId: p.id } });
  for (const s of shorts) {
    if (await para.short.findUnique({ where: { id: s.id } })) continue;
    await para.short.create({
      data: {
        ...s,
        thumbnailUrl: arrumaCaminho(s.thumbnailUrl),
        previewUrl: arrumaCaminho(s.previewUrl),
        renderUrl: arrumaCaminho(s.renderUrl),
      },
    });
  }
  novos++;
  console.log(`  importado: ${p.id} (${shorts.length} cortes) — ${String(p.title).slice(0, 45)}`);
}

console.log(`\n${novos} projeto(s) importado(s), ${pulados} ja existia(m).`);
console.log("total agora:", await para.project.count(), "projetos e", await para.short.count(), "cortes.");

await de.$disconnect();
await para.$disconnect();
