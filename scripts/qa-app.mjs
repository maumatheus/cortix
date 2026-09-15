// QA funcional de ponta a ponta contra um Cortix rodando (desktop ou site).
//   node scripts/qa-app.mjs http://127.0.0.1:43110 email senha [urlYouTube]
// Loga, abre todas as páginas, exercita todas as APIs (cria → edita → apaga), roda o fluxo
// completo link → cortes → render e o servidor MCP. Imprime um relatório PASS/FAIL por item.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

const [BASE = "http://127.0.0.1:43110", EMAIL, SENHA, YT = "https://www.youtube.com/watch?v=NQRKCX3hTqc"] = process.argv.slice(2);
if (!EMAIL || !SENHA) {
  console.error("uso: node scripts/qa-app.mjs <base> <email> <senha> [urlYouTube]");
  process.exit(1);
}

let cookie = "";
const results = [];
const t0 = Date.now();
function log(ok, nome, detalhe = "") {
  results.push({ ok, nome, detalhe });
  console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${detalhe ? "  — " + detalhe : ""}`);
}
async function req(method, url, { json, form, headers = {}, raw = false } = {}) {
  const h = { ...(cookie ? { cookie } : {}), ...headers };
  let body;
  if (json !== undefined) {
    h["content-type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form) body = form;
  const r = await fetch(BASE + url, { method, headers: h, body, redirect: "manual" });
  const sc = r.headers.get("set-cookie");
  if (sc && /cf_session=/.test(sc)) cookie = sc.split(";")[0];
  if (raw) return r;
  const txt = await r.text();
  let data = null;
  try {
    data = JSON.parse(txt);
  } catch {}
  return { status: r.status, data, txt };
}
async function step(nome, fn) {
  try {
    const d = await fn();
    log(true, nome, typeof d === "string" ? d : "");
    return d;
  } catch (e) {
    log(false, nome, e.message);
    return null;
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const okData = (r, msg) => {
  expect(r.status >= 200 && r.status < 300, `${msg || "HTTP"} ${r.status}: ${(r.data?.error || r.data?.message || r.txt || "").toString().slice(0, 120)}`);
  return r.data?.data ?? r.data;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- auth ----------
await step("auth: senha errada é recusada", async () => {
  const r = await req("POST", "/api/auth/login", { json: { email: EMAIL, password: SENHA + "x" } });
  expect(r.status === 401, `esperava 401, veio ${r.status}`);
});
await step("auth: login", async () => {
  const r = await req("POST", "/api/auth/login", { json: { email: EMAIL, password: SENHA } });
  okData(r, "login");
  expect(cookie, "sem cookie de sessão");
  return r.data.data?.offline ? "OFFLINE (tolerância)" : "online";
});
const me = await step("auth: /api/auth/me", async () => okData(await req("GET", "/api/auth/me")).user);

// ---------- páginas ----------
const PAGES = ["/dashboard", "/criar-projeto", "/projects", "/renders", "/quests", "/forum", "/convidar", "/campeonatos", "/financeiro", "/brand-kit", "/templates", "/analytics", "/lives", "/library", "/schedule", "/social-media", "/launcher", "/connect-ai", "/settings"];
for (const p of PAGES) {
  await step(`página ${p}`, async () => {
    const r = await req("GET", p);
    expect(r.status === 200, `HTTP ${r.status}`);
    expect(!/Application error|Internal Server Error|Unhandled Runtime Error/i.test(r.txt), "página com erro de runtime");
    expect(r.txt.includes("<html"), "resposta não é HTML");
  });
}
await step("página /login redireciona logado", async () => {
  const r = await req("GET", "/login", { raw: true });
  expect(r.status === 307 || r.status === 308 || r.status === 200, `HTTP ${r.status}`);
});

// ---------- leitura simples ----------
for (const [nome, url] of [
  ["user", "/api/v1/user"],
  ["credits", "/api/v1/credits"],
  ["quests", "/api/v1/quests"],
  ["referrals", "/api/v1/referrals"],
  ["analytics", "/api/v1/analytics"],
  ["renders", "/api/v1/renders"],
  ["projects", "/api/v1/projects"],
  ["championships", "/api/v1/championships"],
  ["championship-accounts", "/api/v1/championship-accounts"],
  ["forum/posts", "/api/v1/forum/posts"],
  ["brand-kits", "/api/v1/brand-kits"],
  ["templates", "/api/v1/templates"],
  ["library/files", "/api/v1/library/files"],
  ["library/prompts", "/api/v1/library/prompts"],
  ["lives", "/api/v1/lives"],
  ["schedule", "/api/v1/schedule"],
  ["social-accounts", "/api/v1/social-accounts"],
  ["launchers", "/api/v1/launchers"],
  ["tokens", "/api/v1/tokens"],
  ["orders", "/api/v1/orders"],
]) {
  await step(`GET ${nome}`, async () => {
    okData(await req("GET", url));
  });
}

// ---------- CRUDs ----------
await step("user: PATCH nome e volta", async () => {
  okData(await req("PATCH", "/api/v1/user", { json: { name: "QA Cortix" } }));
  const u = okData(await req("GET", "/api/v1/user")).user ?? okData(await req("GET", "/api/v1/user"));
  expect((u.name || "").includes("QA"), "nome não mudou");
  okData(await req("PATCH", "/api/v1/user", { json: { name: me?.name || "Admin" } }));
});

const bk = await step("brand-kit: criar → editar → apagar", async () => {
  const c = okData(await req("POST", "/api/v1/brand-kits", { json: { name: "QA Kit", handle: "@qa", primaryColor: "#00d4ff", secondaryColor: "#76FF03", font: "Montserrat" } }));
  const id = c.kit?.id || c.brandKit?.id || c.id;
  expect(id, "sem id");
  okData(await req("PATCH", `/api/v1/brand-kits/${id}`, { json: { name: "QA Kit 2" } }));
  okData(await req("GET", `/api/v1/brand-kits/${id}`));
  okData(await req("DELETE", `/api/v1/brand-kits/${id}`));
  return "ok";
});

await step("template: criar → usar → apagar", async () => {
  const c = okData(await req("POST", "/api/v1/templates", { json: { name: "QA Template", config: { styleId: "green-fresh", layout: "single", font: "Montserrat" } } }));
  const id = c.template?.id || c.id;
  expect(id, "sem id");
  okData(await req("POST", `/api/v1/templates/${id}/use`));
  okData(await req("PATCH", `/api/v1/templates/${id}`, { json: { name: "QA Template 2" } }));
  okData(await req("DELETE", `/api/v1/templates/${id}`));
});

await step("library: pasta + prompt (criar → editar → apagar)", async () => {
  okData(await req("POST", "/api/v1/library/folders", { json: { name: "QA Pasta", folder: "" } }));
  const c = okData(await req("POST", "/api/v1/library/prompts", { json: { title: "QA Prompt", content: "Escolha momentos com números e perguntas." } }));
  const id = c.prompt?.id || c.id;
  expect(id, "sem id");
  okData(await req("PATCH", `/api/v1/library/prompts/${id}`, { json: { title: "QA Prompt 2" } }));
  okData(await req("DELETE", `/api/v1/library/prompts/${id}`));
});

await step("forum: post → comentário → voto → apagar", async () => {
  const c = okData(await req("POST", "/api/v1/forum/posts", { json: { title: "QA", content: "Post de teste automático", category: "geral" } }));
  const id = c.post?.id || c.id;
  expect(id, "sem id");
  okData(await req("POST", `/api/v1/forum/posts/${id}/comments`, { json: { content: "comentário QA" } }));
  okData(await req("GET", `/api/v1/forum/posts/${id}/comments`));
  okData(await req("POST", `/api/v1/forum/posts/${id}/vote`, { json: { value: 1 } }));
  okData(await req("DELETE", `/api/v1/forum/posts/${id}`));
});

const social = await step("social-account: criar", async () => {
  const c = okData(await req("POST", "/api/v1/social-accounts", { json: { platform: "tiktok", handle: "@qa_cortix", purpose: "publish" } }));
  return c.account?.id || c.socialAccount?.id || c.id;
});

const launcher = await step("launcher: criar → editar", async () => {
  const c = okData(await req("POST", "/api/v1/launchers", { json: { name: "QA Launcher", platforms: ["tiktok", "youtube"], times: ["12:00", "20:00"] } }));
  const id = c.launcher?.id || c.id;
  expect(id, "sem id");
  okData(await req("PATCH", `/api/v1/launchers/${id}`, { json: { status: "paused" } }));
  okData(await req("GET", `/api/v1/launchers/${id}`));
  return id;
});

await step("lives: criar → toggle → apagar", async () => {
  const c = okData(await req("POST", "/api/v1/lives", { json: { name: "QA Live", channelUrl: "https://www.twitch.tv/gaules", prompt: "", minScore: 7 } }));
  const id = c.monitor?.id || c.live?.id || c.id;
  expect(id, "sem id");
  okData(await req("POST", `/api/v1/lives/${id}/toggle`));
  okData(await req("PATCH", `/api/v1/lives/${id}`, { json: { status: "stopped" } }));
  okData(await req("DELETE", `/api/v1/lives/${id}`));
});

await step("championship-accounts: criar → apagar", async () => {
  const c = okData(await req("POST", "/api/v1/championship-accounts", { json: { platform: "tiktok", handle: "@qa_camp", purpose: "championship" } }));
  const id = c.account?.id || c.id;
  expect(id, "sem id");
  okData(await req("DELETE", `/api/v1/championship-accounts/${id}`));
});

await step("championships: detalhe + entradas", async () => {
  const l = okData(await req("GET", "/api/v1/championships"));
  const list = l.championships || l;
  if (!Array.isArray(list) || !list.length) return "nenhum campeonato cadastrado";
  const id = list[0].id;
  okData(await req("GET", `/api/v1/championships/${id}`));
  okData(await req("GET", `/api/v1/championships/${id}/entries`));
  return `${list.length} campeonato(s)`;
});

await step("quests: check-in", async () => {
  const r = await req("POST", "/api/v1/quests/checkin");
  expect(r.status < 500, `HTTP ${r.status} ${r.txt.slice(0, 80)}`);
  return r.status === 200 ? "ok" : `já feito hoje (${r.status})`;
});
await step("quests: giro de prêmios", async () => {
  const r = await req("POST", "/api/v1/quests/spin");
  expect(r.status < 500, `HTTP ${r.status} ${r.txt.slice(0, 80)}`);
  return r.status === 200 ? "ok" : `indisponível (${r.status})`;
});

await step("orders: pacote PIX → confirmar (simulado)", async () => {
  const c = okData(await req("POST", "/api/v1/orders", { json: { kind: "package", credits: 300, method: "pix" } }));
  const id = c.order?.id || c.id;
  expect(id, "sem id");
  const r = await req("POST", `/api/v1/orders/${id}/confirm`);
  expect(r.status < 500, `confirm HTTP ${r.status}`);
  return r.status === 200 ? "confirmado" : `confirm ${r.status}`;
});

// ---------- MCP ----------
await step("tokens + MCP: initialize / tools.list / get_balance", async () => {
  const c = okData(await req("POST", "/api/v1/tokens", { json: { name: "QA" } }));
  const token = typeof c.token === "string" ? c.token : c.token?.token;
  const id = c.token?.id || c.id;
  expect(token, "token não retornado: " + JSON.stringify(c).slice(0, 120));
  const rpc = async (method, params, i) => {
    const r = await fetch(BASE + "/api/mcp", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: i, method, params }) });
    const j = await r.json();
    if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error).slice(0, 120)}`);
    return j.result;
  };
  await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "qa", version: "1" } }, 1);
  const tools = await rpc("tools/list", {}, 2);
  expect((tools.tools || []).length >= 5, "menos de 5 tools");
  await rpc("tools/call", { name: "get_balance", arguments: {} }, 3);
  if (id) okData(await req("DELETE", `/api/v1/tokens/${id}`));
  return `${tools.tools.length} tools`;
});

// ---------- fluxo de vídeo ----------
const meta = await step("videoMetadata (YouTube)", async () => {
  const r = await req("POST", "/api/v1/videoMetadata", { json: { url: YT, clipDuration: "30" } });
  const d = okData(r);
  expect(d.title || d.durationSec, "sem metadata");
  return `${(d.title || "").slice(0, 40)} · ${Math.round(d.durationSec || 0)}s`;
});

let project = null;
let short = null;
if (meta) {
  project = await step("projeto: criar por link (30s, efeitos viral, 2 cortes)", async () => {
    const r = await req("POST", "/api/v1/projects", {
      json: { url: YT, clipDuration: "30", layout: "auto", captionStyleId: "green-fresh", captionFont: "Montserrat", effects: { preset: "viral", handle: "@qa" }, startTime: 0, endTime: 180, targetClips: 2, useMyCredits: true },
    });
    const d = okData(r);
    const p = d.project || d;
    expect(p.id, "sem id");
    return p.id;
  });
  if (project) {
    await step("pipeline: baixar → transcrever → cortes → prévias", async () => {
      const inicio = Date.now();
      let p, shorts;
      for (;;) {
        const r = await req("GET", `/api/v1/projects/${project}`);
        okData(r);
        p = r.data.project;
        shorts = r.data.data || [];
        if (p.status === "ready" || p.status === "failed") break;
        expect(Date.now() - inicio < 15 * 60_000, `tempo esgotado no estágio "${p.stage}" (${p.status} ${p.progress}%)`);
        await sleep(4000);
      }
      expect(p.status === "ready", `projeto ${p.status}: ${p.error}`);
      expect(shorts.length >= 1, "nenhum corte gerado");
      short = shorts.find((s) => s.status === "ready") || shorts[0];
      expect(short.previewUrl, "corte sem prévia");
      const pv = await req("GET", short.previewUrl, { raw: true });
      expect(pv.status === 200, `prévia HTTP ${pv.status}`);
      return `${shorts.length} corte(s) em ${Math.round((Date.now() - inicio) / 1000)}s`;
    });
  }
  if (short) {
    await step("short: GET / PATCH título / hook", async () => {
      okData(await req("GET", `/api/v1/shorts/${short.id}`));
      okData(await req("PATCH", `/api/v1/shorts/${short.id}`, { json: { title: "QA corte" } }));
      const h = await req("POST", `/api/v1/shorts/${short.id}/hook`, { json: {} });
      expect(h.status < 500, `hook HTTP ${h.status}`);
    });
    const render = await step("render 720p com preset monetize", async () => {
      const r = okData(await req("POST", `/api/v1/shorts/${short.id}/render`, { json: { resolution: "720x1280", effects: { preset: "monetize", handle: "@qa" } } }));
      const inicio = Date.now();
      let st;
      for (;;) {
        st = okData(await req("GET", `/api/v1/shorts/${short.id}/render`)).render;
        if (!st || st.status === "done" || st.status === "failed") break;
        expect(Date.now() - inicio < 10 * 60_000, "render demorou mais de 10 min");
        await sleep(3000);
      }
      expect(st && st.status === "done", `render ${st?.status}: ${st?.error}`);
      const f = await req("GET", st.url, { raw: true });
      expect(f.status === 200, `arquivo HTTP ${f.status}`);
      const buf = Buffer.from(await f.arrayBuffer());
      const tmp = path.join(os.tmpdir(), "cortix-qa-render.mp4");
      fs.writeFileSync(tmp, buf);
      const pr = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height,duration", "-of", "csv=p=0", tmp], { encoding: "utf8" });
      const linhas = (pr.stdout || "").trim().split("\n");
      const v = linhas.find((l) => l.startsWith("video"));
      const a = linhas.find((l) => l.startsWith("audio"));
      expect(v && a, "ffprobe: sem vídeo ou áudio");
      const dv = Number(v.split(",")[3]);
      const da = Number(a.split(",").pop());
      expect(Math.abs(dv - da) < 0.5, `vídeo ${dv}s × áudio ${da}s dessincronizados`);
      return `${v.split(",")[1]}x${v.split(",")[2]} · ${dv.toFixed(1)}s · ${(buf.length / 1e6).toFixed(1)} MB · A/V ok`;
    });
    if (render && launcher) {
      await step("launcher: adicionar corte → remover → apagar", async () => {
        const c = okData(await req("POST", `/api/v1/launchers/${launcher}/items`, { json: { shortId: short.id } }));
        const items = c.launcher?.items || c.items || [];
        const item = items.find((i) => i.shortId === short.id) || items[0];
        if (item?.id) okData(await req("DELETE", `/api/v1/launchers/${launcher}/items/${item.id}`));
        okData(await req("DELETE", `/api/v1/launchers/${launcher}`));
      });
    }
    await step("schedule: agendar → editar → cancelar → batch", async () => {
      const when = new Date(Date.now() + 2 * 3600_000).toISOString();
      const c = okData(await req("POST", "/api/v1/schedule", { json: { shortId: short.id, platform: "tiktok", caption: "QA", scheduledAt: when, socialAccountId: social || null } }));
      const id = c.post?.id || c.scheduledPost?.id || c.id;
      expect(id, "sem id");
      okData(await req("PATCH", `/api/v1/schedule/${id}`, { json: { caption: "QA 2" } }));
      okData(await req("DELETE", `/api/v1/schedule/${id}`));
      okData(await req("POST", "/api/v1/schedule/batch", { json: { shortIds: [short.id], platform: "youtube", startAt: when, intervalHours: 4, maxPerDay: 3, caption: "lote" } }));
    });
  }
}

// ---------- upload ----------
await step("upload: arquivo de vídeo → projeto", async () => {
  const tmp = path.join(os.tmpdir(), "cortix-qa-upload.mp4");
  const gen = spawnSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=5", "-f", "lavfi", "-i", "sine=frequency=440:duration=5", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest", tmp]);
  expect(gen.status === 0, "ffmpeg não gerou o arquivo de teste");
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(tmp)], { type: "video/mp4" }), "qa-upload.mp4");
  const r = await req("POST", "/api/v1/upload", { form });
  const d = okData(r, "upload");
  expect(d.sourcePath || d.path || d.project, "upload sem caminho");
  return "ok";
});

// ---------- limpeza ----------
if (social) await step("social-account: apagar", async () => okData(await req("DELETE", `/api/v1/social-accounts/${social}`)));
if (launcher) {
  const r = await req("DELETE", `/api/v1/launchers/${launcher}`);
  if (r.status === 200) log(true, "launcher: apagar (limpeza)");
}
if (project) await step("projeto: apagar", async () => okData(await req("DELETE", `/api/v1/projects/${project}`)));

await step("auth: logout → /me 401", async () => {
  okData(await req("POST", "/api/auth/logout"));
  cookie = "";
  const r = await req("GET", "/api/auth/me");
  expect(r.status === 401, `esperava 401, veio ${r.status}`);
});

// ---------- relatório ----------
const pass = results.filter((r) => r.ok).length;
console.log(`\n${pass}/${results.length} passaram em ${Math.round((Date.now() - t0) / 1000)}s`);
for (const r of results.filter((r) => !r.ok)) console.log(`  ✖ ${r.nome}: ${r.detalhe}`);
process.exit(pass === results.length ? 0 : 1);
