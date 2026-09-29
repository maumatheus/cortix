/**
 * Smoke test do Upload-Post sem gastar envio: sobe um servidor falso da API, conecta a conta
 * (sync), agenda um post e roda o publicador até o envio assíncrono virar "published".
 * Uso: npx tsx scripts/smoke-uploadpost.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

async function main() {
  let statusCalls = 0;
  let instagramOn = false;
  let uploadedBytes = 0;
  const forms: Array<{ route: string; fields: Array<[string, string]> }> = [];
  const server = http.createServer((req, res) => {
    const send = (code: number, body: unknown) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.headers.authorization !== "Apikey chave-de-teste-com-mais-de-20") return send(401, { message: "bad key" });
    const url = new URL(req.url!, "http://x");
    if (req.method === "GET" && url.pathname.startsWith("/api/uploadposts/users/"))
      return send(200, { success: true, profile: { username: decodeURIComponent(url.pathname.split("/").pop()!), social_accounts: { tiktok: { handle: "canaldecortes" }, instagram: instagramOn ? { username: "canal.ig" } : "", youtube: instagramOn ? { handle: "@canalyt" } : "" } } });
    if (req.method === "POST" && (url.pathname === "/api/upload" || url.pathname === "/api/upload_photos")) {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => {
        uploadedBytes += c.length;
        chunks.push(c);
      });
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("latin1");
        forms.push({ route: url.pathname, fields: [...raw.matchAll(/name="([^"]+)"(?:; filename="[^"]*")?\r\n(?:Content-Type: [^\r]+\r\n)?\r\n([^\r]{0,200})/g)].map((m) => [m[1], Buffer.from(m[2], "latin1").toString("utf8")] as [string, string]) });
        send(200, { success: true, request_id: `req-${forms.length === 1 ? 123 : forms.length}`, total_platforms: 1 });
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/uploadposts/status") {
      statusCalls++;
      if (url.searchParams.get("request_id") !== "req-123") return send(200, { status: "completed", results: [{ platform: "any", success: true, url: `https://x/${url.searchParams.get("request_id")}`, post_id: "9" }] });
      return send(200, statusCalls < 2 ? { status: "in_progress" } : { status: "completed", results: [{ platform: "tiktok", success: true, url: "https://tiktok.com/@canaldecortes/video/1", post_id: "1" }] });
    }
    send(404, { message: "rota falsa não existe" });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const port = (server.address() as { port: number }).port;
  process.env.UPLOADPOST_API_URL = `http://127.0.0.1:${port}/api`;
  process.env.UPLOADPOST_API_KEY = "chave-de-teste-com-mais-de-20";

  const { db } = await import("../src/lib/db");
  const { newId } = await import("../src/lib/ids");
  const { syncUploadPostAccounts, profileName } = await import("../src/lib/social/uploadpost");
  const { publishDuePosts } = await import("../src/lib/publisher");

  const video = path.resolve("storage/smoke/src.mp4");
  assert.ok(fs.existsSync(video), "precisa de storage/smoke/src.mp4 (gerado pelo smoke-effects)");
  const user = await db.user.findFirst();
  assert.ok(user, "precisa de um usuário (npm run seed)");
  const project = await db.project.create({ data: { id: newId(), userId: user.id, title: "smoke uploadpost" } });
  try {
    const short = await db.short.create({ data: { id: newId(), projectId: project.id, title: "corte smoke", startTime: 0, endTime: 10 } });
    await db.render.create({ data: { id: newId(), shortId: short.id, userId: user.id, status: "done", filePath: video, completedAt: new Date() } });

    const found = await syncUploadPostAccounts(user.id);
    assert.deepEqual(found.map((f) => `${f.platform}:${f.handle}`), ["tiktok:@canaldecortes"], "instagram vazio não conta como conectado");
    const acc = await db.socialAccount.findFirst({ where: { userId: user.id, platform: "tiktok", connection: "uploadpost" } });
    assert.equal(acc?.externalId, profileName(user.id));

    const post = await db.scheduledPost.create({ data: { id: newId(), userId: user.id, shortId: short.id, socialAccountId: acc!.id, platform: "tiktok", caption: "legenda #cortes", scheduledAt: new Date(Date.now() - 1000) } });
    await publishDuePosts(user.id);
    let p = await db.scheduledPost.findUnique({ where: { id: post.id } });
    assert.equal(p?.status, "publishing");
    assert.equal(p?.externalId, "req:req-123");
    assert.ok(uploadedBytes > fs.statSync(video).size, "o vídeo tem que ter subido no multipart");

    assert.equal(statusCalls, 1, "a mesma rodada já consulta o status (in_progress)");
    await publishDuePosts(user.id); // status: completed
    p = await db.scheduledPost.findUnique({ where: { id: post.id } });
    assert.equal(p?.status, "published");
    assert.equal(p?.externalUrl, "https://tiktok.com/@canaldecortes/video/1");
    console.log("ok:", p?.status, p?.externalUrl);
    await db.scheduledPost.delete({ where: { id: post.id } });
    await db.socialAccount.delete({ where: { id: acc!.id } });

    await esteiraEstudio({ db, newId, syncUploadPostAccounts, publishDuePosts, video, forms, ligar: () => (instagramOn = true) });
  } finally {
    await db.project.delete({ where: { id: project.id } });
    await db.$disconnect();
    server.close();
  }
  console.log("smoke-uploadpost: tudo certo");
}

/** COR-5: carrossel no Instagram, YouTube pelo Upload-Post com metadados e MP4 local (videoPath), num usuário descartável. */
async function esteiraEstudio(ctx: {
  db: typeof import("../src/lib/db").db;
  newId: () => string;
  syncUploadPostAccounts: (userId: string) => Promise<unknown>;
  publishDuePosts: (userId?: string) => Promise<unknown>;
  video: string;
  forms: Array<{ route: string; fields: Array<[string, string]> }>;
  ligar: () => void;
}) {
  const { db, newId } = ctx;
  const { createScheduledPost } = await import("../src/lib/schedule");
  const { execFileSync } = await import("node:child_process");
  const tag = newId();
  const user = await db.user.create({ data: { id: tag, name: "smoke estudio", email: `smoke-estudio-${tag}@local`, passwordHash: "x", referralCode: `E${tag.slice(-10)}`, plan: "viral" } });
  const imgs = [1, 2, 3].map((i) => path.resolve(`storage/smoke/slide-${i}.jpg`));
  for (const [i, p] of imgs.entries()) execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", String(i), "-i", ctx.video, "-frames:v", "1", p]);
  try {
    ctx.ligar();
    await ctx.syncUploadPostAccounts(user.id);
    const accs = await db.socialAccount.findMany({ where: { userId: user.id, connection: "uploadpost" } });
    const ig = accs.find((a) => a.platform === "instagram")!;
    const yt = accs.find((a) => a.platform === "youtube")!;
    assert.ok(ig && yt, "instagram e youtube conectados via Upload-Post");

    const quando = () => new Date(Date.now() + 1500).toISOString();
    await assert.rejects(createScheduledPost(user, { platform: "youtube", socialAccountId: yt.id, scheduledAt: quando(), meta: { carousel: { images: imgs } } }), /Carrossel só/);
    const car = await createScheduledPost(user, { platform: "instagram", socialAccountId: ig.id, caption: "3 segredos do GTA 6 #gta6", scheduledAt: quando(), meta: { carousel: { images: imgs } } });
    const vid = await createScheduledPost(user, {
      platform: "youtube",
      socialAccountId: yt.id,
      caption: "fallback",
      scheduledAt: quando(),
      meta: { videoPath: ctx.video, youtube: { title: "Título YT", description: "Desc", tags: ["gta6", "gta"], categoryId: "20", playlistId: "PL1", publishAt: "2026-12-01T18:00:00-03:00", madeForKids: false, thumbnailPath: imgs[0] } },
    });
    await new Promise((r) => setTimeout(r, 1600));
    await ctx.publishDuePosts(user.id);

    const fotos = ctx.forms.find((f) => f.route === "/api/upload_photos");
    assert.ok(fotos, "carrossel foi pro /upload_photos");
    assert.equal(fotos.fields.filter(([k]) => k === "photos[]").length, 3, "3 imagens no carrossel");
    assert.deepEqual(fotos.fields.find(([k]) => k === "platform[]"), ["platform[]", "instagram"]);
    const ytForm = ctx.forms.filter((f) => f.route === "/api/upload").at(-1)!;
    const campo = (k: string) => ytForm.fields.filter(([n]) => n === k).map(([, v]) => v);
    assert.deepEqual(campo("platform[]"), ["youtube"]);
    assert.deepEqual(campo("youtube_title"), ["Título YT"]);
    assert.deepEqual(campo("tags[]"), ["gta6", "gta"]);
    assert.deepEqual(campo("categoryId"), ["20"]);
    assert.deepEqual(campo("selfDeclaredMadeForKids"), ["false"]);
    assert.deepEqual(campo("youtube_playlist_id"), ["PL1"]);
    assert.deepEqual(campo("youtube_publish_at"), [new Date("2026-12-01T18:00:00-03:00").toISOString()]);
    assert.equal(campo("thumbnail").length, 1, "thumbnail anexada");
    assert.equal(campo("video").length, 1, "MP4 local (videoPath) anexado");

    const posts = await db.scheduledPost.findMany({ where: { id: { in: [car.id, vid.id] } } });
    assert.ok(posts.every((p) => p.status === "published"), posts.map((p) => `${p.platform}:${p.status}:${p.error}`).join(" | "));
    console.log("ok: carrossel (3 fotos) no Instagram + YouTube via Upload-Post com metadados e videoPath");
  } finally {
    await db.user.delete({ where: { id: user.id } });
    for (const p of imgs) fs.rmSync(p, { force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
