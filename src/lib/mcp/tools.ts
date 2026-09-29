import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { isSubscriber } from "@/lib/auth";
import { chargeCredits, manualClipsCost, projectCost } from "@/lib/credits";
import { resolveEffects } from "@/lib/effects";
import { createScheduledPost, ScheduleError } from "@/lib/schedule";
import { parsePostMeta } from "@/lib/post-meta";
import { publishDuePosts } from "@/lib/publisher";
import { FREE_CLIPS, FREE_PROJECT_EXPIRY_DAYS, getPlan } from "@/lib/plans";
import { getCaptionStyle } from "@/lib/caption-styles";
import { estimateClips, fetchMetadata } from "@/lib/video/ytdlp";
import { enqueue } from "@/lib/video/queue";

type User = NonNullable<Awaited<ReturnType<typeof db.user.findUnique>>>;

export class ToolError extends Error {
  code: number;
  constructor(message: string, code = -32602) {
    super(message);
    this.code = code;
  }
}

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const TOOLS: ToolDef[] = [
  {
    name: "list_projects",
    description: "Lista os projetos do usuário no Cortix (título, status, quantidade de cortes). Use `limit` pra limitar a quantidade.",
    inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 50, description: "Quantidade máxima (padrão 20)" }, status: { type: "string", description: "Filtra por status: queued, ready, failed…" } } },
  },
  {
    name: "get_project",
    description: "Detalhes de um projeto e a lista dos seus cortes (shorts) com score, duração, status e URL renderizada.",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "ID do projeto" } }, required: ["id"] },
  },
  {
    name: "create_project",
    description: "Cria um projeto de cortes a partir de um link do YouTube (ou VOD Twitch/Kick). Cobra 1 crédito por minuto analisado, ou usa os clipes grátis. O processamento é assíncrono: use get_project pra acompanhar.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL do vídeo" },
        clipDuration: { type: "string", description: "auto | 30 | 60 | 90 | 180 (segundos)", default: "auto" },
        startTime: { type: "number", description: "Início do trecho a analisar, em segundos" },
        endTime: { type: "number", description: "Fim do trecho a analisar, em segundos" },
        captionStyleId: { type: "string", description: "ID do estilo de legenda (ex.: green-fresh)" },
        clips: {
          type: "array",
          description: "Cortes com in/out já definidos (segundos). Pula a seleção automática; cobra só os minutos dos cortes.",
          items: { type: "object", properties: { start: { type: "number" }, end: { type: "number" }, title: { type: "string" }, hook: { type: "string" } }, required: ["start", "end"] },
        },
        layout: { type: "string", description: "auto (padrão: vídeo largo → câmera segue quem fala) | single | single-clean | center | split…", default: "auto" },
        effects: { type: "string", description: "Preset de efeitos: none | viral | monetize…", default: "none" },
        autoRender: { type: "boolean", description: "Renderiza em 1080x1920 assim que os cortes ficarem prontos (get_short devolve o caminho do MP4)", default: false },
      },
      required: ["url"],
    },
  },
  {
    name: "render_short",
    description: "Renderiza um corte (short) em MP4 vertical com legendas. Devolve o ID do render; o arquivo fica disponível em get_project quando concluir.",
    inputSchema: { type: "object", properties: { shortId: { type: "string", description: "ID do corte" }, resolution: { type: "string", enum: ["1080x1920", "720x1280"] } }, required: ["shortId"] },
  },
  {
    name: "get_short",
    description: "Status de um corte e do último render: status, progresso e caminho local do MP4 (filePath) quando pronto.",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "ID do corte (short)" } }, required: ["id"] },
  },
  {
    name: "list_social_accounts",
    description: "Contas conectadas pra publicação (id, plataforma, @, tipo de conexão, canal). Use o id em schedule_post.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "schedule_post",
    description:
      "Agenda a publicação numa conta: um corte do Cortix (shortId), um MP4 local (meta.videoPath, ex.: render do Remotion) ou um carrossel de fotos (meta.carousel, Instagram/Facebook/TikTok). No horário o Cortix envia pela API oficial (YouTube Data API em conta oauth, que sobe PRIVADO até o app Google passar na auditoria; Graph API da Meta em conta meta: Reels e carrossel no Instagram/Facebook) ou pelo Upload-Post (quebra-galho do TikTok, 10 envios/mês no grátis). Regras: 3 posts/24h e 2h de intervalo por conta, e trava eleitoral no canal de política. Pra YouTube, meta.youtube aceita título, descrição, tags, categoria, playlist, publishAt, madeForKids e thumbnail.",
    inputSchema: {
      type: "object",
      properties: {
        shortId: { type: "string", description: "ID do corte (precisa estar renderizado na hora de publicar)" },
        socialAccountId: { type: "string", description: "ID da conta (list_social_accounts)" },
        platform: { type: "string", enum: ["youtube", "tiktok", "instagram", "facebook"] },
        caption: { type: "string", description: "Legenda (TikTok/Instagram) ou fallback de título/descrição (YouTube)" },
        scheduledAt: { type: "string", description: "Quando publicar, ISO 8601 com fuso (ex.: 2026-10-01T18:00:00-03:00)" },
        meta: {
          type: "object",
          properties: {
            videoPath: { type: "string", description: "Caminho local de um MP4 pra publicar no lugar de um corte do Cortix" },
            carousel: {
              type: "object",
              description: "Carrossel de fotos: 1 a 10 imagens JPG/PNG locais, na ordem",
              properties: { images: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 10 }, title: { type: "string" } },
              required: ["images"],
            },
            youtube: {
              type: "object",
              properties: {
                title: { type: "string", description: "Até 100 caracteres" },
                description: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                categoryId: { type: "string", description: "20 = Games, 22 = Pessoas e blogs, 24 = Entretenimento, 25 = Notícias e política" },
                playlistId: { type: "string" },
                publishAt: { type: "string", description: "ISO 8601: sobe privado e o YouTube publica nessa hora" },
                privacy: { type: "string", enum: ["public", "unlisted", "private"] },
                madeForKids: { type: "boolean", default: false },
                thumbnailPath: { type: "string", description: "Caminho local de JPG/PNG até 2 MB" },
              },
            },
          },
        },
      },
      required: ["platform", "scheduledAt"],
    },
  },
  {
    name: "get_post",
    description: "Status de um post agendado: scheduled | publishing | published | failed | canceled, com link publicado (externalUrl) e erro/aviso.",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "ID do post" } }, required: ["id"] },
  },
  {
    name: "list_posts",
    description: "Lista posts agendados/publicados, mais recentes primeiro. Filtros opcionais: status e platform.",
    inputSchema: { type: "object", properties: { status: { type: "string" }, platform: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 100 } } },
  },
  {
    name: "get_balance",
    description: "Saldo de créditos, clipes grátis restantes e plano atual do usuário.",
    inputSchema: { type: "object", properties: {} },
  },
];

export async function callTool(name: string, args: Record<string, unknown>, user: User): Promise<unknown> {
  switch (name) {
    case "list_projects":
      return listProjects(user, args);
    case "get_project":
      return getProject(user, args);
    case "create_project":
      return createProject(user, args);
    case "render_short":
      return renderShort(user, args);
    case "get_short":
      return getShort(user, args);
    case "list_social_accounts":
      return listSocialAccounts(user);
    case "schedule_post":
      return schedulePost(user, args);
    case "get_post":
      return getPost(user, args);
    case "list_posts":
      return listPosts(user, args);
    case "get_balance":
      return getBalance(user);
    default:
      throw new ToolError(`Ferramenta desconhecida: ${name}`, -32601);
  }
}

async function listProjects(user: User, args: Record<string, unknown>) {
  const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
  const status = typeof args.status === "string" && args.status ? args.status : undefined;
  const items = await db.project.findMany({
    where: { userId: user.id, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { _count: { select: { shorts: true } } },
  });
  return {
    projects: items.map((p) => ({ id: p.id, title: p.title, status: p.status, stage: p.stage, progress: p.progress, url: p.url, durationSec: p.durationSec, shortsCount: p._count.shorts, createdAt: p.createdAt, isFree: p.isFree, expiresAt: p.expiresAt })),
  };
}

async function getProject(user: User, args: Record<string, unknown>) {
  const id = String(args.id || "");
  if (!id) throw new ToolError("Informe o id do projeto");
  const p = await db.project.findFirst({ where: { id, userId: user.id }, include: { shorts: { orderBy: { score: "desc" } } } });
  if (!p) throw new ToolError("Projeto não encontrado");
  return {
    project: { id: p.id, title: p.title, status: p.status, stage: p.stage, progress: p.progress, error: p.error, url: p.url, durationSec: p.durationSec, channelTitle: p.channelTitle, createdAt: p.createdAt, expiresAt: p.expiresAt },
    shorts: p.shorts.map((s) => ({ id: s.id, title: s.title, score: s.score, reason: s.reason, startTime: s.startTime, endTime: s.endTime, durationSec: Math.round(s.endTime - s.startTime), status: s.status, renderUrl: s.renderUrl, thumbnailUrl: s.thumbnailUrl, isPublished: s.isPublished, isScheduled: s.isScheduled })),
  };
}

/** Versão mínima de POST /api/v1/projects: cobra créditos (1/min) ou usa clipes grátis e enfileira. */
async function createProject(user: User, args: Record<string, unknown>) {
  const url = String(args.url || "").trim();
  if (!url) throw new ToolError("Informe a url do vídeo");
  const clipDuration = typeof args.clipDuration === "string" && args.clipDuration ? args.clipDuration : "auto";
  const clips = parseClips(args.clips);
  const meta = await fetchMetadata(url);
  const durationSec = meta.durationSec;
  if (clips && durationSec && clips.some((c) => c.end > durationSec + 1)) throw new ToolError(`Corte passa do fim do vídeo (${Math.round(durationSec)}s)`);
  const startTime = clips ? clips[0].start : Math.max(0, Number(args.startTime) || 0);
  const endRaw = clips ? Math.max(...clips.map((c) => c.end)) : Number(args.endTime) || 0;
  const endTime = endRaw > startTime ? Math.min(endRaw, durationSec || endRaw) : durationSec;

  const fresh = await db.user.findUnique({ where: { id: user.id } });
  if (!fresh) throw new ToolError("Usuário não encontrado");
  const cost = clips ? manualClipsCost(clips) : projectCost(startTime, endTime || durationSec);
  const freeLeft = Math.max(0, FREE_CLIPS - fresh.freeClipsUsed);
  let targetClips = clips ? clips.length : estimateClips(Math.max(1, endTime - startTime), clipDuration);
  let isFree = false;
  let creditsCharged = 0;
  if (fresh.credits >= cost) {
    await chargeCredits(fresh.id, cost, `Projeto: ${meta.title}`);
    creditsCharged = cost;
  } else if (!isSubscriber(fresh) && freeLeft > 0) {
    isFree = true;
    targetClips = Math.min(targetClips, freeLeft);
    await db.user.update({ where: { id: fresh.id }, data: { freeClipsUsed: { increment: targetClips } } });
  } else {
    throw new ToolError(`Créditos insuficientes: você tem ${fresh.credits} e precisa de ${cost}. Compre créditos em /financeiro.`);
  }

  const styleId = typeof args.captionStyleId === "string" ? args.captionStyleId : undefined;
  const style = getCaptionStyle(styleId);
  const id = newId();
  const project = await db.project.create({
    data: {
      id,
      userId: fresh.id,
      title: meta.title,
      url: meta.url,
      platform: meta.platform,
      videoId: meta.videoId,
      thumbnailUrl: meta.thumbnailUrl,
      channelTitle: meta.channelTitle,
      durationSec,
      language: meta.language,
      clipDuration,
      captionTemplate: JSON.stringify(style),
      captionFont: style.fontFamily,
      layout: typeof args.layout === "string" && args.layout ? args.layout : "auto",
      effects: JSON.stringify(resolveEffects(typeof args.effects === "string" && args.effects ? args.effects : "none")),
      manualClips: clips ? JSON.stringify(clips.slice(0, targetClips)) : null,
      autoRender: args.autoRender === true,
      startTime,
      endTime,
      estimatedClips: targetClips,
      targetClips,
      isFree,
      creditsCharged,
      expiresAt: isFree ? new Date(Date.now() + FREE_PROJECT_EXPIRY_DAYS * 86400_000) : null,
      status: "queued",
      stage: "Na fila",
    },
  });
  if (creditsCharged) {
    await db.creditTransaction.updateMany({ where: { userId: fresh.id, refId: null, type: "usage", description: `Projeto: ${project.title}` }, data: { refId: id } });
  }
  enqueue({ kind: "project", id });
  return { project: { id: project.id, title: project.title, status: project.status, durationSec, targetClips, isFree, creditsCharged }, message: "Projeto criado e na fila. Use get_project pra acompanhar o progresso." };
}

function parseClips(raw: unknown) {
  if (raw == null) return null;
  if (!Array.isArray(raw) || !raw.length) throw new ToolError("clips precisa ser uma lista de { start, end }");
  if (raw.length > 40) throw new ToolError("No máximo 40 cortes por projeto");
  const clips = raw.map((c, i) => {
    const o = (c ?? {}) as Record<string, unknown>;
    const start = Number(o.start);
    const end = Number(o.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) throw new ToolError(`clips[${i}]: end precisa ser maior que start (segundos)`);
    return { start, end, title: typeof o.title === "string" ? o.title.slice(0, 200) : undefined, hook: typeof o.hook === "string" ? o.hook.slice(0, 200) : undefined };
  });
  return clips.sort((a, b) => a.start - b.start);
}

async function getShort(user: User, args: Record<string, unknown>) {
  const id = String(args.id || "");
  if (!id) throw new ToolError("Informe o id do corte");
  const s = await db.short.findFirst({ where: { id, project: { userId: user.id } } });
  if (!s) throw new ToolError("Corte não encontrado");
  const r = await db.render.findFirst({ where: { shortId: s.id }, orderBy: { createdAt: "desc" } });
  return {
    short: { id: s.id, projectId: s.projectId, title: s.title, hook: s.hook, startTime: s.startTime, endTime: s.endTime, layout: s.layout, status: s.status, previewUrl: s.previewUrl, thumbnailUrl: s.thumbnailUrl, isScheduled: s.isScheduled, isPublished: s.isPublished },
    render: r ? { id: r.id, status: r.status, progress: r.progress, resolution: r.resolution, filePath: r.status === "done" ? r.filePath : null, url: r.url, durationSec: r.durationSec, error: r.error } : null,
  };
}

async function listSocialAccounts(user: User) {
  const items = await db.socialAccount.findMany({ where: { userId: user.id, purpose: "publish" }, orderBy: { createdAt: "asc" }, select: { id: true, platform: true, handle: true, connection: true, channel: true } });
  return { accounts: items, userChannel: user.channel ?? null };
}

async function schedulePost(user: User, args: Record<string, unknown>) {
  const meta = (args.meta ?? {}) as { videoPath?: unknown; carousel?: unknown };
  if (!args.shortId && !meta.videoPath && !meta.carousel) throw new ToolError("Informe shortId, meta.videoPath ou meta.carousel");
  try {
    const post = await createScheduledPost(user, args as never);
    return { post: { id: post.id, platform: post.platform, status: post.status, scheduledAt: post.scheduledAt, account: post.socialAccount?.handle ?? null }, message: "Agendado. Use get_post pra acompanhar." };
  } catch (e) {
    if (e instanceof ScheduleError) throw new ToolError(e.message);
    if ((e as Error).name === "ZodError") throw new ToolError(`Parâmetros inválidos: ${(e as Error).message}`);
    throw e;
  }
}

type PostRow = { id: string; platform: string; status: string; scheduledAt: Date; publishedAt: Date | null; externalId: string | null; externalUrl: string | null; error: string | null; caption: string; meta: string | null; shortId: string | null; socialAccountId: string | null };

function postView(p: PostRow) {
  const pending = p.externalId?.startsWith("req:") || p.externalId?.startsWith("ig:");
  return { id: p.id, platform: p.platform, status: p.status, scheduledAt: p.scheduledAt, publishedAt: p.publishedAt, externalId: pending ? null : p.externalId, externalUrl: p.externalUrl, error: p.error, shortId: p.shortId, socialAccountId: p.socialAccountId, caption: p.caption, meta: parsePostMeta(p.meta) };
}

async function getPost(user: User, args: Record<string, unknown>) {
  const id = String(args.id || "");
  if (!id) throw new ToolError("Informe o id do post");
  await publishDuePosts(user.id);
  const p = await db.scheduledPost.findFirst({ where: { id, userId: user.id } });
  if (!p) throw new ToolError("Post não encontrado");
  return { post: postView(p) };
}

async function listPosts(user: User, args: Record<string, unknown>) {
  const limit = Math.min(100, Math.max(1, Number(args.limit) || 30));
  await publishDuePosts(user.id);
  const status = typeof args.status === "string" && args.status ? args.status : undefined;
  const platform = typeof args.platform === "string" && args.platform ? args.platform : undefined;
  const items = await db.scheduledPost.findMany({ where: { userId: user.id, ...(status ? { status } : {}), ...(platform ? { platform } : {}) }, orderBy: { scheduledAt: "desc" }, take: limit });
  return { posts: items.map(postView) };
}

async function renderShort(user: User, args: Record<string, unknown>) {
  const shortId = String(args.shortId || "");
  if (!shortId) throw new ToolError("Informe o shortId");
  const resolution = args.resolution === "720x1280" ? "720x1280" : "1080x1920";
  const short = await db.short.findFirst({ where: { id: shortId, project: { userId: user.id } }, include: { project: true } });
  if (!short) throw new ToolError("Corte não encontrado");
  if (short.status === "pending") throw new ToolError("Este corte ainda não está pronto pra renderizar");
  if (short.status === "rendering") {
    const active = await db.render.findFirst({ where: { shortId: short.id, status: { in: ["queued", "processing"] } }, orderBy: { createdAt: "desc" } });
    if (active) return { render: { id: active.id, status: active.status, progress: active.progress }, reused: true };
  }
  const watermark = !(isSubscriber(user) || !short.project.isFree);
  const render = await db.render.create({ data: { id: newId(), shortId: short.id, userId: user.id, resolution, watermark, status: "queued" } });
  await db.short.update({ where: { id: short.id }, data: { status: "rendering", renderProgress: 0, watermark } });
  enqueue({ kind: "render", id: render.id });
  return { render: { id: render.id, status: render.status, resolution, watermark }, message: "Render na fila. Consulte get_project pra pegar a URL quando concluir." };
}

async function getBalance(user: User) {
  const fresh = await db.user.findUnique({ where: { id: user.id } });
  if (!fresh) throw new ToolError("Usuário não encontrado");
  const plan = getPlan(fresh.plan);
  return {
    credits: fresh.credits,
    freeClipsLeft: Math.max(0, FREE_CLIPS - fresh.freeClipsUsed),
    plan: plan ? { id: plan.id, name: plan.name, renewsAt: fresh.planRenewsAt } : null,
    isSubscriber: isSubscriber(fresh),
    note: "1 crédito = 1 minuto de vídeo analisado.",
  };
}
