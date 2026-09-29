/**
 * Smoke test da publicação direta (sem Upload-Post) contra APIs falsas do Google e da Meta:
 * - YouTube Data API: sem auditoria sobe PRIVADO e o post fica com o aviso; auditado respeita a privacidade.
 * - Graph API: conecta Página + IG, Reel e carrossel no Instagram (container assíncrono) e no Facebook.
 * - Trava eleitoral do canal de política vale também na Meta (nada chega na API).
 * Uso: npx tsx scripts/smoke-publicacao-direta.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execFileSync } from "node:child_process";

type Call = { method: string; path: string; params: URLSearchParams; auth?: string; bytes: number; headers: http.IncomingHttpHeaders; json?: unknown };

async function main() {
  const calls: Call[] = [];
  let containerPolls = 0;
  let seq = 0;
  let base = "";
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks);
      const url = new URL(req.url!, "http://x");
      const ct = req.headers["content-type"] ?? "";
      const params = new URLSearchParams(url.search);
      if (ct.startsWith("application/x-www-form-urlencoded")) for (const [k, v] of new URLSearchParams(raw.toString("utf8"))) params.set(k, v);
      if (ct.startsWith("multipart/form-data")) for (const m of raw.toString("latin1").matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)/g)) params.set(m[1], m[2]);
      const call: Call = { method: req.method!, path: url.pathname, params, auth: req.headers.authorization, bytes: raw.length, headers: req.headers };
      if (ct.startsWith("application/json")) call.json = JSON.parse(raw.toString("utf8") || "null");
      calls.push(call);
      const send = (code: number, body: unknown, headers: Record<string, string> = {}) => {
        res.writeHead(code, { "Content-Type": "application/json", ...headers });
        res.end(JSON.stringify(body));
      };
      const p = url.pathname;

      // ---- Google
      if (p === "/upload/youtube/v3/videos") return send(200, {}, { location: `${base}/yt-session/${++seq}` });
      if (p.startsWith("/yt-session/")) return send(200, { id: `YT${p.split("/").pop()}` });

      // ---- Meta
      if (p.startsWith("/rupload/")) return send(200, { success: true });
      const g = p.replace(/^\/v23\.0\//, "");
      if (g === "oauth/access_token") return send(200, { access_token: params.get("fb_exchange_token") ? "user-long" : "user-short" });
      if (g === "me/accounts") return send(200, { data: [{ id: "PAGE1", name: "Fase Secreta", access_token: "page-token", instagram_business_account: { id: "IG1", username: "fasesecretabr" } }] });
      if (g === "me") return send(200, { id: "PAGE1" });
      if (g === "PAGE1/photos") return send(200, { id: `PH${++seq}` });
      if (/^PH\d+$/.test(g)) return send(200, { images: [{ source: `https://scontent.fbcdn.net/${g}.jpg`, width: 1080 }] });
      if (g === "IG1/media") {
        if (params.get("upload_type") === "resumable") return send(200, { id: "CREEL", uri: `${base}/rupload/ig-api-upload/v23.0/CREEL` });
        return send(200, { id: params.get("media_type") === "CAROUSEL" ? "CCAR" : `CIMG${++seq}` });
      }
      if (g === "CREEL" || g === "CCAR") return send(200, { status_code: ++containerPolls % 2 === 1 ? "IN_PROGRESS" : "FINISHED" });
      if (g === "IG1/media_publish") return send(200, { id: `M-${params.get("creation_id")}` });
      if (g.startsWith("M-")) return send(200, { permalink: `https://www.instagram.com/p/${g}/` });
      if (g === "PAGE1/video_reels") return params.get("upload_phase") === "start" ? send(200, { video_id: "V1", upload_url: `${base}/rupload/video-upload/v23.0/V1` }) : send(200, { success: true });
      if (g === "PAGE1/feed") return send(200, { id: "PAGE1_POST1" });
      send(404, { error: { message: `rota falsa não existe: ${p}` } });
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  process.env.YOUTUBE_API_URL = base;
  process.env.META_GRAPH_URL = base;
  process.env.META_RUPLOAD_URL = `${base}/rupload`;
  process.env.META_GRAPH_VERSION = "v23.0";
  process.env.META_APP_ID = "1234567890123456";
  process.env.META_APP_SECRET = "0123456789abcdef0123456789abcdef";
  delete process.env.YOUTUBE_AUDITED;

  const { db } = await import("../src/lib/db");
  const { newId } = await import("../src/lib/ids");
  const { connectMetaAccounts } = await import("../src/lib/social/meta");
  const { youtubeAudited } = await import("../src/lib/social/config");
  const { publishDuePosts } = await import("../src/lib/publisher");
  const { createScheduledPost } = await import("../src/lib/schedule");
  assert.equal(youtubeAudited(), false, "storage/integrations.json está com youtube.audited = true; o smoke precisa do estado sem auditoria");

  const video = path.resolve("storage/smoke/src.mp4");
  assert.ok(fs.existsSync(video), "precisa de storage/smoke/src.mp4 (gerado pelo smoke-effects)");
  const imgs = [1, 2, 3].map((i) => path.resolve(`storage/smoke/slide-${i}.jpg`));
  for (const [i, p] of imgs.entries()) if (!fs.existsSync(p)) execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", String(i), "-i", video, "-frames:v", "1", p]);

  const tag = newId();
  const user = await db.user.create({ data: { id: tag, name: "smoke direta", email: `smoke-direta-${tag}@local`, passwordHash: "x", referralCode: `D${tag.slice(-10)}`, plan: "viral" } });
  const past = () => new Date(Date.now() - 1000);
  const post = (socialAccountId: string, platform: string, meta: unknown, caption = "legenda #teste") =>
    db.scheduledPost.create({ data: { id: newId(), userId: user.id, socialAccountId, platform, caption, meta: JSON.stringify(meta), scheduledAt: past() } });
  const get = (id: string) => db.scheduledPost.findUniqueOrThrow({ where: { id } });
  try {
    // ---------- YouTube direto
    const yt = await db.socialAccount.create({ data: { id: newId(), userId: user.id, platform: "youtube", handle: "@fasesecretabr", purpose: "publish", connection: "oauth", externalId: "UC1", accessToken: "yt-token", tokenExpiresAt: new Date(Date.now() + 3600_000) } });
    const p1 = await post(yt.id, "youtube", { videoPath: video, youtube: { title: "Teste", privacy: "public", publishAt: new Date(Date.now() + 86400_000).toISOString() } });
    await publishDuePosts(user.id);
    let r = await get(p1.id);
    assert.equal(r.status, "published");
    assert.match(r.error ?? "", /PRIVADO/, "sem auditoria o post fica com aviso de privado");
    assert.match(r.error ?? "", /studio\.youtube\.com\/video\/YT\d+\/edit/);
    let init = calls.filter((c) => c.path === "/upload/youtube/v3/videos").at(-1)!.json as { status: { privacyStatus: string; publishAt?: string } };
    assert.equal(init.status.privacyStatus, "private", "sem auditoria força privado");
    assert.equal(init.status.publishAt, undefined, "sem auditoria não manda publishAt (o YouTube não publicaria)");

    process.env.YOUTUBE_AUDITED = "1";
    const p2 = await post(yt.id, "youtube", { videoPath: video, youtube: { title: "Teste 2", privacy: "public" } });
    await publishDuePosts(user.id);
    r = await get(p2.id);
    assert.equal(r.status, "published");
    assert.equal(r.error, null, "auditado: sem aviso");
    init = calls.filter((c) => c.path === "/upload/youtube/v3/videos").at(-1)!.json as { status: { privacyStatus: string } };
    assert.equal(init.status.privacyStatus, "public");
    delete process.env.YOUTUBE_AUDITED;
    console.log("ok: YouTube privado sem auditoria, público com auditoria");

    // ---------- Meta: conectar
    const { connected } = await connectMetaAccounts(user.id, "user-long");
    assert.deepEqual(connected, ["facebook:Fase Secreta", "instagram:@fasesecretabr"]);
    const fb = await db.socialAccount.findFirstOrThrow({ where: { userId: user.id, platform: "facebook" }, omit: { accessToken: false } });
    const ig = await db.socialAccount.findFirstOrThrow({ where: { userId: user.id, platform: "instagram" }, omit: { accessToken: false } });
    assert.equal(fb.connection, "meta");
    assert.equal(ig.externalId, "IG1");
    assert.equal(ig.accessToken, "page-token", "IG publica com o token da Página");
    assert.ok(calls.filter((c) => c.path.startsWith("/v23.0/")).every((c) => !c.path.includes("token") || c.path.endsWith("oauth/access_token")), "token nunca vai na rota");

    // ---------- Instagram Reel
    const p3 = await post(ig.id, "instagram", { videoPath: video });
    await publishDuePosts(user.id); // cria container + upload; mesma rodada consulta: IN_PROGRESS
    r = await get(p3.id);
    assert.equal(r.status, "publishing");
    assert.equal(r.externalId, "ig:CREEL");
    const up = calls.find((c) => c.path === "/rupload/ig-api-upload/v23.0/CREEL")!;
    assert.equal(up.auth, "OAuth page-token");
    assert.equal(up.headers.file_size, String(fs.statSync(video).size));
    assert.equal(up.bytes, fs.statSync(video).size, "o vídeo inteiro subiu");
    const reelParams = calls.find((c) => c.path === "/v23.0/IG1/media" && c.params.get("upload_type") === "resumable")!.params;
    assert.equal(reelParams.get("media_type"), "REELS");
    assert.equal(reelParams.get("caption"), "legenda #teste");
    await publishDuePosts(user.id); // FINISHED → media_publish
    r = await get(p3.id);
    assert.equal(r.status, "published");
    assert.equal(r.externalUrl, "https://www.instagram.com/p/M-CREEL/");
    console.log("ok: Reel no Instagram", r.externalUrl);

    // ---------- Instagram carrossel (agendado pela regra normal)
    const c1 = await createScheduledPost(user, { platform: "instagram", socialAccountId: ig.id, caption: "carrossel", scheduledAt: new Date(Date.now() + 3 * 3600_000).toISOString(), meta: { carousel: { images: imgs } } });
    await db.scheduledPost.update({ where: { id: c1.id }, data: { scheduledAt: past() } });
    const antes = calls.length;
    await publishDuePosts(user.id);
    await publishDuePosts(user.id);
    r = await get(c1.id);
    assert.equal(r.status, "published", r.error ?? "");
    const novos = calls.slice(antes);
    assert.equal(novos.filter((c) => c.path === "/v23.0/PAGE1/photos" && c.params.get("published") === "false").length, 3, "3 fotos hospedadas na Página");
    assert.equal(novos.filter((c) => c.path === "/v23.0/IG1/media" && c.params.get("is_carousel_item") === "true").length, 3);
    const car = novos.find((c) => c.params.get("media_type") === "CAROUSEL")!;
    assert.equal(car.params.get("children")!.split(",").length, 3);
    assert.match(novos.find((c) => c.params.get("is_carousel_item"))!.params.get("image_url")!, /fbcdn/);
    console.log("ok: carrossel no Instagram", r.externalUrl);

    // ---------- Facebook Reel + carrossel
    const p5 = await post(fb.id, "facebook", { videoPath: video }, "reel fb");
    await publishDuePosts(user.id);
    r = await get(p5.id);
    assert.equal(r.status, "published");
    assert.equal(r.externalUrl, "https://www.facebook.com/reel/V1");
    const fin = calls.find((c) => c.path === "/v23.0/PAGE1/video_reels" && c.params.get("upload_phase") === "finish")!;
    assert.equal(fin.params.get("video_state"), "PUBLISHED");
    assert.equal(fin.params.get("description"), "reel fb");
    const c2 = await createScheduledPost(user, { platform: "facebook", socialAccountId: fb.id, caption: "fotos fb", scheduledAt: new Date(Date.now() + 3 * 3600_000).toISOString(), meta: { carousel: { images: imgs.slice(0, 2) } } });
    await db.scheduledPost.update({ where: { id: c2.id }, data: { scheduledAt: past() } });
    await publishDuePosts(user.id);
    r = await get(c2.id);
    assert.equal(r.status, "published");
    const feed = calls.find((c) => c.path === "/v23.0/PAGE1/feed")!;
    assert.equal(feed.params.get("message"), "fotos fb");
    assert.ok(feed.params.get("attached_media[1]"), "2 fotos anexadas");
    console.log("ok: Reel + carrossel no Facebook");

    // ---------- Trava eleitoral na Meta
    await db.socialAccount.update({ where: { id: ig.id }, data: { channel: "politica" } });
    const eleicao = new Date("2026-10-03T12:00:00-03:00");
    const p7 = await db.scheduledPost.create({ data: { id: newId(), userId: user.id, socialAccountId: ig.id, platform: "instagram", caption: "x", meta: JSON.stringify({ videoPath: video }), scheduledAt: new Date(eleicao.getTime() - 1000) } });
    const n = calls.length;
    await publishDuePosts(user.id, { now: eleicao });
    r = await get(p7.id);
    assert.equal(r.status, "failed");
    assert.match(r.error ?? "", /elei/i);
    assert.equal(calls.length, n, "nada chegou na Graph API durante a trava");
    await assert.rejects(createScheduledPost(user, { platform: "instagram", socialAccountId: ig.id, scheduledAt: eleicao.toISOString(), meta: { videoPath: video } }), /elei|Escolha um horário/i);
    console.log("ok: trava eleitoral bloqueia a Meta");
  } finally {
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
    server.close();
  }
  console.log("smoke-publicacao-direta: tudo certo");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
