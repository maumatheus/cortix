/**
 * Cria (ou atualiza) o usuário do Cortix de um canal do estúdio: 1 usuário por canal (plano viral, 6 contas),
 * cada um com as próprias contas e o próprio token do MCP. Depois, logado como o canal, em Redes Sociais:
 *   - YouTube → "Entrar com Google" escolhendo a conta de marca do canal (sobe PRIVADO até a auditoria do Google);
 *   - Instagram/Facebook → "Entrar com Facebook" marcando SÓ a Página e o IG deste canal (Graph API, grátis);
 *   - TikTok → Upload-Post (quebra-galho: 10 envios/mês no grátis).
 * As credenciais dos apps (Google Client ID/Secret, Meta App ID/Secret) são da instalação e valem pros dois canais.
 *
 * Uso: npx tsx scripts/criar-canal.ts <slug> <senha> [canal-de-regra]
 *   npx tsx scripts/criar-canal.ts fase-secreta 'senha-forte'
 *   npx tsx scripts/criar-canal.ts missao-resumo 'senha-forte' politica   ← liga a trava eleitoral
 *
 * Imprime o token do MCP UMA vez: guarde no .env do cortix-studio (CORTIX_TOKEN_<SLUG>), nunca no git.
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { migrateSqlite } from "../src/lib/db-migrate";
import { newId } from "../src/lib/ids";
import { resolveChannel } from "../src/lib/schedule-rules";

async function main() {
  const [slug, senha, regra] = process.argv.slice(2);
  if (!slug || !/^[a-z0-9-]{3,40}$/.test(slug) || !senha) {
    console.error("Uso: npx tsx scripts/criar-canal.ts <slug> <senha> [canal-de-regra]");
    process.exit(1);
  }
  await migrateSqlite();
  const channel = resolveChannel(regra || slug, null);
  const passwordHash = await bcrypt.hash(senha, 10);
  const yearly = new Date(Date.now() + 365 * 86400_000);
  const existente = await db.user.findUnique({ where: { email: slug } });
  const user = existente
    ? await db.user.update({ where: { id: existente.id }, data: { passwordHash, channel, plan: "viral", planCycle: "yearly", planRenewsAt: yearly } })
    : await db.user.create({
        data: { id: newId(), name: slug, email: slug, passwordHash, channel, credits: 5000, referralCode: `C${newId().slice(-10).toUpperCase()}`, plan: "viral", planCycle: "yearly", planRenewsAt: yearly },
      });
  const token = `cf_${randomBytes(24).toString("hex")}`;
  await db.apiToken.create({ data: { id: newId(), userId: user.id, name: `estudio-${slug}`, token } });

  console.log(`${existente ? "Atualizado" : "Criado"}: usuário "${slug}" (canal de regra: ${channel})`);
  console.log(`Login: ${slug} / (a senha informada)`);
  console.log(`\nToken do MCP (mostrado só agora):\n  CORTIX_TOKEN_${slug.toUpperCase().replace(/-/g, "_")}=${token}`);
  console.log(`\nPróximo passo: entrar no Cortix como "${slug}" → Redes sociais → conectar TikTok ou Instagram (abre a página do Upload-Post) e, lá, conectar TikTok, Instagram e YouTube DESTE canal.`);
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
