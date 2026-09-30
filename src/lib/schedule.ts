import { z } from "zod";
import { SOCIAL_PLATFORMS } from "@/lib/social/platforms";
import { db } from "./db";
import { newId } from "./ids";
import { checkPostMeta, postMetaSchema } from "./post-meta";
import { accountKey, airTimes, validateAccountSchedule, validatePostChannels } from "./schedule-rules";

/** Entrada de um post agendado (API v1 POST /schedule e tool schedule_post do MCP). */
export const createPostSchema = z.object({
  shortId: z.string().optional().nullable(),
  socialAccountId: z.string().optional().nullable(),
  platform: z.enum(SOCIAL_PLATFORMS),
  caption: z.string().max(2200).default(""),
  scheduledAt: z.string().min(1, "Informe a data e hora"),
  meta: postMetaSchema.optional(),
});

export type CreatePostInput = z.input<typeof createPostSchema>;

export const postInclude = {
  short: { select: { id: true, title: true, thumbnailUrl: true, renderUrl: true, status: true, projectId: true, project: { select: { title: true } } } },
  socialAccount: { select: { id: true, platform: true, handle: true } },
};

export class ScheduleError extends Error {
  status: number;
  extra?: Record<string, unknown>;
  constructor(message: string, status = 400, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/** Valida (conta, corte, trava do canal, 3/24h e 2h de intervalo, meta) e cria o post. */
export async function createScheduledPost(user: { id: string; channel?: string | null }, input: CreatePostInput) {
  const body = createPostSchema.parse(input);
  const when = new Date(body.scheduledAt);
  if (isNaN(when.getTime())) throw new ScheduleError("Data inválida", 422);
  if (when.getTime() < Date.now() - 60_000) throw new ScheduleError("Escolha um horário no futuro");

  let account = null;
  if (body.socialAccountId) {
    account = await db.socialAccount.findFirst({ where: { id: body.socialAccountId, userId: user.id } });
    if (!account) throw new ScheduleError("Conta não encontrada", 404);
    if (account.platform !== body.platform) throw new ScheduleError("A conta escolhida não é da plataforma selecionada");
  }
  if (body.shortId) {
    const short = await db.short.findFirst({ where: { id: body.shortId, project: { userId: user.id } } });
    if (!short) throw new ScheduleError("Corte não encontrado", 404);
  }
  const captionErr = checkCaption(body.caption);
  if (captionErr) throw new ScheduleError(captionErr, 422, { rule: "caption" });
  const metaErr = checkPostMeta(body.meta);
  if (metaErr) throw new ScheduleError(metaErr, 422);
  if (body.meta?.carousel) {
    if (body.platform === "youtube") throw new ScheduleError("Carrossel só no Instagram, no Facebook ou no TikTok", 422);
    if (account && !["uploadpost", "meta", "instagram"].includes(account.connection)) throw new ScheduleError("Carrossel só sai por conta conectada pela Meta (Facebook ou login do Instagram) ou via Upload-Post", 422);
  } else if (account && account.connection !== "simulated" && !body.shortId && !body.meta?.videoPath) {
    throw new ScheduleError("Informe o corte (shortId), um vídeo local (meta.videoPath) ou um carrossel (meta.carousel)", 422);
  }

  // trava eleitoral / regras do canal
  const blocked = validatePostChannels(account?.channel, user.channel, airTimes(when, body.meta));
  if (blocked) throw new ScheduleError(blocked, 400, { rule: "channel-blackout" });

  // regras por conta: 3 posts / 24h e 2h de intervalo
  const key = accountKey(body.socialAccountId, body.platform);
  const siblings = await db.scheduledPost.findMany({
    where: { userId: user.id, status: { in: ["scheduled", "publishing", "published"] }, ...(body.socialAccountId ? { socialAccountId: body.socialAccountId } : { socialAccountId: null, platform: body.platform }) },
    select: { scheduledAt: true },
  });
  const err = validateAccountSchedule(siblings.map((s) => s.scheduledAt), [when]);
  if (err) throw new ScheduleError(err, 400, { rule: key });

  const post = await db.scheduledPost.create({
    data: {
      id: newId(),
      userId: user.id,
      shortId: body.shortId ?? null,
      socialAccountId: body.socialAccountId ?? null,
      platform: body.platform,
      caption: body.caption,
      meta: body.meta ? JSON.stringify(body.meta) : null,
      scheduledAt: when,
      status: "scheduled",
    },
    include: postInclude,
  });
  if (body.shortId) await db.short.update({ where: { id: body.shortId }, data: { isScheduled: true } });
  return post;
}

/** Pega legenda que é na verdade o arquivo de instruções inteiro (ex.: textos.md colado com títulos markdown). */
export function checkCaption(caption: string): string | null {
  if (/^#{1,6}\s/m.test(caption)) return "A legenda tem título markdown (\"# ...\"). Mande só o texto da legenda, sem o arquivo de instruções.";
  if (/postar as imagens|na ordem \(\d|^legenda\s*\(/im.test(caption)) return "A legenda parece conter instruções internas. Mande só o texto que vai ao ar.";
  return null;
}
