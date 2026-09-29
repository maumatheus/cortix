/**
 * Smoke REAL do Instagram (login do Instagram) SEM publicar: roda o caminho do publicador até o container
 * ficar FINISHED e para antes do media_publish (só ele publica; o container sem publicar expira em 24h).
 * Também valida a hospedagem temporária (capa) e apaga o arquivo no fim.
 *
 * Uso (banco descartável, nada toca o banco do app):
 *   IG_TOKEN=IGAA... IG_USER_ID=1784... IG_TOKEN_EXPIRA=2026-11-27 \
 *   MEDIA_HOST_SUPABASE_URL=https://xxx.supabase.co MEDIA_HOST_SUPABASE_KEY=... \
 *   npx tsx scripts/smoke-instagram.ts <video.mp4> [capa.png]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cortix-smoke-ig-"));
process.env.DATABASE_URL = `file:${path.join(tmp, "smoke.db").replace(/\\/g, "/")}`;
process.env.STORAGE_DIR = path.join(tmp, "storage");

async function main() {
  const [video, capa] = process.argv.slice(2);
  const token = process.env.IG_TOKEN;
  const igId = process.env.IG_USER_ID;
  if (!video || !token || !igId) throw new Error("Uso: IG_TOKEN=... IG_USER_ID=... npx tsx scripts/smoke-instagram.ts <video.mp4> [capa.png]");
  const { db } = await import("../src/lib/db");
  const { migrateSqlite } = await import("../src/lib/db-migrate");
  const { newId } = await import("../src/lib/ids");
  const { publishMetaVideo, META_PENDING_PREFIX } = await import("../src/lib/social/meta");
  const { mediaHostReady, purgeHosted } = await import("../src/lib/social/media-host");

  const { execSync } = await import("node:child_process");
  execSync("npx prisma db push --skip-generate", { stdio: "ignore", env: process.env });
  await migrateSqlite();

  const userId = newId();
  await db.user.create({ data: { id: userId, name: "smoke", email: `smoke-${userId}`, passwordHash: "x", referralCode: `S${userId.slice(-10)}`, plan: "viral" } });
  const accId = newId();
  const expira = process.env.IG_TOKEN_EXPIRA ? new Date(`${process.env.IG_TOKEN_EXPIRA}T00:00:00-03:00`) : new Date(Date.now() + 30 * 86400_000);
  // validade informada > 10 dias → o smoke não renova (nem gasta) o token
  await db.socialAccount.create({ data: { id: accId, userId, platform: "instagram", handle: "@smoke", purpose: "publish", connection: "instagram", externalId: igId, accessToken: token, tokenExpiresAt: expira } });

  const ok = (m: string) => console.log(`  ✓ ${m}`);
  const cover = capa && mediaHostReady() ? capa : undefined;
  if (capa && !cover) console.log("  ! sem MEDIA_HOST_*: testando sem capa");

  const t0 = Date.now();
  const r = await publishMetaVideo(accId, { filePath: video, caption: "smoke (não publicado)", coverPath: cover });
  if (!("requestId" in r) || !r.requestId.startsWith(META_PENDING_PREFIX)) throw new Error("esperava container pendente ig:");
  const container = r.requestId.slice(META_PENDING_PREFIX.length);
  ok(`container criado (vídeo por URL temporária) (${((Date.now() - t0) / 1000).toFixed(1)}s)${cover ? " com capa hospedada" : ""}`);

  // mesmo GET que o publicador faz, mas sem o media_publish
  let status = "";
  for (let i = 0; i < 60; i++) {
    const res = await fetch(`https://graph.instagram.com/v23.0/${container}?fields=status_code,status`, { headers: { Authorization: `Bearer ${token}` } });
    const j = (await res.json()) as { status_code?: string; status?: string; error?: { message?: string } };
    if (j.error) throw new Error(j.error.message);
    status = j.status_code ?? "";
    if (status === "FINISHED" || status === "ERROR" || status === "EXPIRED") break;
    await new Promise((s) => setTimeout(s, 5000));
  }
  if (status !== "FINISHED") throw new Error(`container terminou em ${status || "timeout"}`);
  ok(`Instagram processou o Reel: FINISHED em ${((Date.now() - t0) / 1000).toFixed(0)}s (NÃO publicado)`);

  if (cover) {
    // o Instagram já buscou a capa: apaga o que tiver mais de 1 min no bucket
    ok(`hospedagem ok, ${await purgeHosted(60_000)} arquivo(s) apagado(s) do bucket`);
  }
  await db.$disconnect();
  console.log("smoke-instagram: OK");
}

main().catch((e) => {
  console.error("smoke-instagram FALHOU:", (e as Error).message);
  process.exit(1);
});
