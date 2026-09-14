import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { isSubscriber } from "@/lib/auth";
import { chargeCredits, projectCost } from "@/lib/credits";
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
  const meta = await fetchMetadata(url);
  const durationSec = meta.durationSec;
  const startTime = Math.max(0, Number(args.startTime) || 0);
  const endRaw = Number(args.endTime) || 0;
  const endTime = endRaw > startTime ? Math.min(endRaw, durationSec || endRaw) : durationSec;

  const fresh = await db.user.findUnique({ where: { id: user.id } });
  if (!fresh) throw new ToolError("Usuário não encontrado");
  const cost = projectCost(startTime, endTime || durationSec);
  const freeLeft = Math.max(0, FREE_CLIPS - fresh.freeClipsUsed);
  let targetClips = estimateClips(Math.max(1, endTime - startTime), clipDuration);
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
