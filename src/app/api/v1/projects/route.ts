import { z } from "zod";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { isSubscriber } from "@/lib/auth";
import { ok, readJson, withUser } from "@/lib/api";
import { chargeCredits, projectCost } from "@/lib/credits";
import { FREE_CLIPS, FREE_PROJECT_EXPIRY_DAYS } from "@/lib/plans";
import { getCaptionStyle } from "@/lib/caption-styles";
import { resolveEffects } from "@/lib/effects";
import { estimateClips, fetchMetadata } from "@/lib/video/ytdlp";
import { enqueue } from "@/lib/video/queue";

const createSchema = z.object({
  url: z.string().optional(),
  sourcePath: z.string().optional(),
  title: z.string().optional(),
  clipDuration: z.string().default("auto"),
  aspectRatio: z.string().default("vertical"),
  layout: z.string().default("auto"),
  captionTemplate: z.record(z.string(), z.unknown()).optional(),
  captionStyleId: z.string().optional(),
  captionFont: z.string().default("Montserrat"),
  emojisEnabled: z.boolean().default(false),
  autoCta: z.boolean().default(false),
  ignoreCaptions: z.boolean().default(false),
  /** id de preset ("viral", "monetize"...) ou objeto parcial de EffectsConfig (aceita { preset, handle, ... }) */
  effects: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  startTime: z.number().min(0).default(0),
  endTime: z.number().min(0).optional(),
  useMyCredits: z.boolean().default(false),
  targetClips: z.number().int().min(1).max(40).optional(),
});

export const GET = withUser(async ({ req, user }) => {
  const u = new URL(req.url);
  const q = u.searchParams.get("q")?.trim();
  const status = u.searchParams.get("status");
  const sort = u.searchParams.get("sort") || "recent";
  const page = Math.max(1, Number(u.searchParams.get("page")) || 1);
  const limit = Math.min(60, Number(u.searchParams.get("limit")) || 24);
  const where = {
    userId: user!.id,
    ...(q ? { title: { contains: q } } : {}),
    ...(status && status !== "all" ? { status } : {}),
  };
  const [total, items] = await Promise.all([
    db.project.count({ where }),
    db.project.findMany({
      where,
      orderBy: sort === "oldest" ? { createdAt: "asc" } : sort === "title" ? { title: "asc" } : { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { shorts: true } } },
    }),
  ]);
  return ok({
    data: items.map((p) => ({ ...p, shortsCount: p._count.shorts, transcript: undefined })),
    page,
    limit,
    total,
    lastPage: Math.max(1, Math.ceil(total / limit)),
  });
});

export const POST = withUser(async ({ req, user }) => {
  const body = createSchema.parse(await readJson(req));
  const subscriber = isSubscriber(user!);
  if (!body.url && !body.sourcePath) {
    const err = new Error("Informe um link ou envie um arquivo") as Error & { status: number };
    err.status = 422;
    throw err;
  }
  let meta = null;
  if (body.url) meta = await fetchMetadata(body.url);
  const durationSec = meta?.durationSec ?? 0;
  const startTime = body.startTime;
  const endTime = body.endTime && body.endTime > startTime ? Math.min(body.endTime, durationSec || body.endTime) : durationSec;

  const freeLeft = Math.max(0, FREE_CLIPS - user!.freeClipsUsed);
  const wantsFree = !body.useMyCredits && !subscriber && freeLeft > 0;
  let isFree = false;
  let creditsCharged = 0;
  let targetClips = body.targetClips ?? estimateClips(Math.max(1, endTime - startTime), body.clipDuration);

  if (wantsFree) {
    isFree = true;
    targetClips = Math.min(targetClips, freeLeft);
    await db.user.update({ where: { id: user!.id }, data: { freeClipsUsed: { increment: targetClips } } });
  } else {
    const cost = projectCost(startTime, endTime || durationSec);
    await chargeCredits(user!.id, cost, `Projeto: ${body.title || meta?.title || "vídeo"}`);
    creditsCharged = cost;
  }

  const style = body.captionTemplate ?? { ...getCaptionStyle(body.captionStyleId), fontFamily: body.captionFont };
  const id = newId();
  const project = await db.project.create({
    data: {
      id,
      userId: user!.id,
      title: body.title || meta?.title || "Novo projeto",
      url: meta?.url ?? null,
      platform: meta?.platform ?? "upload",
      videoId: meta?.videoId ?? null,
      thumbnailUrl: meta?.thumbnailUrl ?? null,
      channelTitle: meta?.channelTitle ?? null,
      durationSec,
      language: meta?.language ?? null,
      clipDuration: body.clipDuration,
      aspectRatio: body.aspectRatio,
      layout: body.layout,
      captionTemplate: JSON.stringify(style),
      captionFont: body.captionFont,
      emojisEnabled: body.emojisEnabled,
      autoCta: body.autoCta,
      ignoreCaptions: body.ignoreCaptions,
      effects: JSON.stringify(resolveEffects(body.effects ?? "none")),
      startTime,
      endTime,
      estimatedClips: targetClips,
      targetClips,
      isFree,
      creditsCharged,
      expiresAt: isFree ? new Date(Date.now() + FREE_PROJECT_EXPIRY_DAYS * 86400_000) : null,
      sourcePath: body.sourcePath ?? null,
      status: "queued",
      stage: "Na fila",
    },
  });
  if (creditsCharged) {
    await db.creditTransaction.updateMany({ where: { userId: user!.id, refId: null, type: "usage", description: `Projeto: ${project.title}` }, data: { refId: id } });
  }
  enqueue({ kind: "project", id });
  return ok({ message: "Projeto criado.", project: { ...project, transcript: undefined } });
});
