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
  let uploadedBytes = 0;
  const server = http.createServer((req, res) => {
    const send = (code: number, body: unknown) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.headers.authorization !== "Apikey chave-de-teste-com-mais-de-20") return send(401, { message: "bad key" });
    const url = new URL(req.url!, "http://x");
    if (req.method === "GET" && url.pathname.startsWith("/api/uploadposts/users/"))
      return send(200, { success: true, profile: { username: decodeURIComponent(url.pathname.split("/").pop()!), social_accounts: { tiktok: { handle: "canaldecortes" }, instagram: "" } } });
    if (req.method === "POST" && url.pathname === "/api/upload") {
      req.on("data", (c: Buffer) => (uploadedBytes += c.length));
      req.on("end", () => send(200, { success: true, request_id: "req-123", total_platforms: 1 }));
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/uploadposts/status") {
      statusCalls++;
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
  } finally {
    await db.project.delete({ where: { id: project.id } });
    await db.$disconnect();
    server.close();
  }
  console.log("smoke-uploadpost: tudo certo");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
