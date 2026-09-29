/**
 * Conecta uma conta profissional do Instagram (API do Instagram com login do Instagram) a um usuário do Cortix,
 * sem abrir a interface. O token vem do painel da Meta (Casos de uso › API do Instagram › Gerar token) e é lido
 * de variável de ambiente pra não ficar no histórico do terminal. O Cortix renova o token sozinho (60 dias).
 *
 * Opcional: MEDIA_HOST_SUPABASE_URL + MEDIA_HOST_SUPABASE_KEY [+ MEDIA_HOST_BUCKET] gravam a hospedagem
 * temporária de imagens (capa do Reel e carrossel) no integrations.json.
 *
 * Uso:
 *   IG_TOKEN=IGAA... npx tsx scripts/conectar-instagram.ts <email-ou-slug-do-usuario> [canal]
 * Com o banco do app desktop: DATABASE_URL="file:C:/Users/<você>/AppData/Roaming/Cortix/cortix.db" STORAGE_DIR=".../Cortix/storage"
 */
import { db } from "../src/lib/db";
import { migrateSqlite } from "../src/lib/db-migrate";
import { saveMediaHostConfig } from "../src/lib/social/config";
import { connectInstagramToken } from "../src/lib/social/meta";

async function main() {
  const [who, channel] = process.argv.slice(2);
  const token = process.env.IG_TOKEN?.trim();
  if (!who || !token) {
    console.error("Uso: IG_TOKEN=IGAA... npx tsx scripts/conectar-instagram.ts <email-ou-slug> [canal]");
    process.exit(1);
  }
  await migrateSqlite();
  const user = await db.user.findUnique({ where: { email: who } });
  if (!user) throw new Error(`Usuário "${who}" não existe nesse banco`);
  const r = await connectInstagramToken(user.id, token, channel ?? undefined);
  console.log(`${r.created ? "Conectada" : "Atualizada"}: ${r.handle} (conta ${r.id}) — token válido até ${r.expiresAt.toISOString().slice(0, 10)}`);

  const url = process.env.MEDIA_HOST_SUPABASE_URL;
  const key = process.env.MEDIA_HOST_SUPABASE_KEY;
  if (url && key) {
    saveMediaHostConfig({ url: url.replace(/\/$/, ""), serviceKey: key, bucket: process.env.MEDIA_HOST_BUCKET || "cortix-midia" });
    console.log("Hospedagem de imagens gravada no integrations.json");
  }
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error((e as Error).message);
  await db.$disconnect();
  process.exit(1);
});
