/**
 * Smoke test do Cortix dirigido por agente (COR-3), sem UI e sem rede:
 *  1. corte com in/out manuais + preset monetize + autoRender → MP4 no disco (get_short)
 *  2. schedule_post no YouTube com título, descrição, tags, categoria, playlist, publishAt,
 *     madeForKids=false e thumbnail → confere o que foi mandado pra API do Google (fetch falso)
 *  3. get_post / list_posts devolvem o status publicado com o link
 * Uso: npx tsx scripts/smoke-agente.ts [video.mp4]
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { db } from "../src/lib/db";
import { migrateSqlite } from "../src/lib/db-migrate";
import { newId } from "../src/lib/ids";
import { resolveEffects } from "../src/lib/effects";
import { processProject } from "../src/lib/video/pipeline";
import { callTool, ToolError } from "../src/lib/mcp/tools";
import { publishDuePosts } from "../src/lib/publisher";

const video = process.argv[2] || path.resolve(__dirname, "../../cortix-studio/assets/gameplay/gta/gta6-dirigindo.mp4");

async function waitRenders(projectId: string, timeoutMs = 10 * 60_000) {
  const t0 = Date.now();
  for (;;) {
    const rs = await db.render.findMany({ where: { short: { projectId } } });
    if (rs.length && rs.every((r) => r.status === "done" || r.status === "failed")) return rs;
    if (Date.now() - t0 > timeoutMs) throw new Error("renders não terminaram a tempo");
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function main() {
  assert.ok(fs.existsSync(video), `vídeo de teste não encontrado: ${video}`);
  await migrateSqlite();
  const tag = newId();
  const user = await db.user.create({ data: { id: tag, name: "smoke agente", email: `smoke-agente-${tag}@local`, passwordHash: "x", referralCode: `A${tag.slice(-10)}`, credits: 50 } });
  const realFetch = globalThis.fetch;
  try {
    // 1. corte manual (o create_project do MCP baixa do YouTube; aqui o arquivo é local, mesmo caminho do pipeline)
    const project = await db.project.create({
      data: {
        id: newId(),
        userId: user.id,
        title: "smoke agente",
        platform: "upload",
        sourcePath: video,
        effects: JSON.stringify(resolveEffects("monetize")),
        manualClips: JSON.stringify([{ start: 0.5, end: 2.5, title: "Corte A" }, { start: 3, end: 4.8, title: "Corte B" }]),
        autoRender: true,
        targetClips: 2,
        status: "queued",
      },
    });
    const t0 = Date.now();
    await processProject(project.id);
    const p = await db.project.findUnique({ where: { id: project.id }, include: { shorts: { orderBy: { startTime: "asc" } } } });
    assert.equal(p?.status, "ready", `projeto: ${p?.error}`);
    assert.deepEqual(p!.shorts.map((s) => [s.title, s.startTime, s.endTime]), [["Corte A", 0.5, 2.5], ["Corte B", 3, 4.8]], "in/out manuais respeitados");
    const renders = await waitRenders(project.id);
    assert.ok(renders.every((r) => r.status === "done"), `render falhou: ${renders.map((r) => r.error).join(" | ")}`);
    const got = (await callTool("get_short", { id: p!.shorts[0].id }, user)) as { render: { filePath: string } };
    assert.ok(got.render.filePath && fs.existsSync(got.render.filePath), "get_short devolve o MP4 no disco");
    const dim = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", got.render.filePath]).toString().trim();
    assert.equal(dim, "1080,1920");
    console.log(`ok: 2 cortes manuais renderizados em ${Math.round((Date.now() - t0) / 1000)}s → ${got.render.filePath}`);

    // 2. publicar no YouTube com metadados completos (API do Google falsa)
    const thumb = path.join(os.tmpdir(), `smoke-thumb-${tag}.jpg`);
    execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", "1", "-i", video, "-frames:v", "1", "-vf", "scale=1280:720", thumb]);
    const acc = await db.socialAccount.create({ data: { id: newId(), userId: user.id, platform: "youtube", handle: "@smoke", connection: "oauth", accessToken: "tok", refreshToken: "ref", tokenExpiresAt: new Date(Date.now() + 3600_000) } });
    const calls: Array<{ url: string; method: string; body: unknown; headers: Record<string, string> }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.includes("googleapis.com")) return realFetch(input, init);
      const isJson = typeof init?.body === "string";
      calls.push({ url, method: init?.method || "GET", body: isJson ? JSON.parse(init!.body as string) : "<binário>", headers: (init?.headers ?? {}) as Record<string, string> });
      if (url.includes("uploadType=resumable")) return new Response("{}", { status: 200, headers: { location: "https://www.googleapis.com/upload/session/123" } });
      if (url.includes("/upload/session/")) return Response.json({ id: "VID123" });
      if (url.includes("thumbnails/set")) return Response.json({ items: [] });
      if (url.includes("playlistItems")) return Response.json({ id: "PLI1" });
      return new Response("{}", { status: 404 });
    }) as typeof fetch;

    const publishAt = "2026-12-01T18:00:00-03:00";
    const yt = { title: "O segredo do GTA 6", description: "Descrição longa\ncom link", tags: ["gta6", "gta"], categoryId: "20", playlistId: "PL123", publishAt, madeForKids: false, thumbnailPath: thumb };
    await assert.rejects(callTool("schedule_post", { shortId: p!.shorts[0].id, socialAccountId: acc.id, platform: "youtube", scheduledAt: new Date(Date.now() + 5000).toISOString(), meta: { youtube: { ...yt, thumbnailPath: "C:/nao/existe.jpg" } } }, user), ToolError);
    const sched = (await callTool("schedule_post", { shortId: p!.shorts[0].id, socialAccountId: acc.id, platform: "youtube", caption: "fallback #x", scheduledAt: new Date(Date.now() + 5000).toISOString(), meta: { youtube: yt } }, user)) as { post: { id: string } };
    await publishDuePosts(user.id, { now: new Date(Date.now() + 10_000) });

    const init = calls.find((c) => c.url.includes("uploadType=resumable"))!;
    const meta = init.body as { snippet: Record<string, unknown>; status: Record<string, unknown> };
    assert.equal(meta.snippet.title, yt.title);
    assert.match(String(meta.snippet.description), /^Descrição longa/);
    assert.deepEqual(meta.snippet.tags, ["gta6", "gta"]);
    assert.equal(meta.snippet.categoryId, "20");
    assert.equal(meta.status.privacyStatus, "private", "publishAt exige privado");
    assert.equal(meta.status.publishAt, new Date(publishAt).toISOString());
    assert.equal(meta.status.selfDeclaredMadeForKids, false);
    assert.ok(calls.some((c) => c.url.includes("thumbnails/set?videoId=VID123")), "thumbnail enviada");
    const pl = calls.find((c) => c.url.includes("playlistItems"));
    assert.deepEqual((pl?.body as { snippet: unknown }).snippet, { playlistId: "PL123", resourceId: { kind: "youtube#video", videoId: "VID123" } });

    // 3. status
    const st = (await callTool("get_post", { id: sched.post.id }, user)) as { post: { status: string; externalUrl: string; error: string | null } };
    assert.equal(st.post.status, "published", `post: ${st.post.error}`);
    assert.equal(st.post.externalUrl, "https://youtube.com/shorts/VID123");
    const list = (await callTool("list_posts", { status: "published" }, user)) as { posts: unknown[] };
    assert.equal(list.posts.length, 1);
    console.log("ok: YouTube recebeu título/descrição/tags/categoria/publishAt/madeForKids + thumbnail + playlist; get_post =", st.post.status, st.post.externalUrl);
    fs.rmSync(thumb, { force: true });
  } finally {
    globalThis.fetch = realFetch;
    const projects = await db.project.findMany({ where: { userId: user.id }, select: { id: true } });
    await db.user.delete({ where: { id: user.id } }); // cascade: projetos, cortes, renders, contas, posts
    for (const pr of projects) fs.rmSync(path.join(process.cwd(), "storage", "projects", pr.id), { recursive: true, force: true });
  }
  console.log("smoke-agente: tudo certo");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
