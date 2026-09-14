import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, readJson, withUser } from "@/lib/api";
import { newId } from "@/lib/ids";
import { buildBatchSlots, MAX_POSTS_PER_DAY, MIN_GAP_HOURS, validateAccountSchedule } from "@/lib/schedule-rules";

const schema = z.object({
  shortIds: z.array(z.string()).min(1, "Selecione pelo menos um corte").max(60),
  platform: z.enum(["tiktok", "instagram", "youtube"]),
  socialAccountId: z.string().optional().nullable(),
  startAt: z.string().min(1, "Informe a data de início"),
  intervalHours: z.number().min(MIN_GAP_HOURS).max(24).default(MIN_GAP_HOURS),
  maxPerDay: z.number().int().min(1).max(MAX_POSTS_PER_DAY).default(MAX_POSTS_PER_DAY),
  caption: z.string().max(2200).default(""),
});

export const POST = withUser(async ({ req, user }) => {
  const body = schema.parse(await readJson(req));
  const start = new Date(body.startAt);
  if (isNaN(start.getTime())) return fail("Data inválida", 422);
  if (start.getTime() < Date.now() - 60_000) return fail("Escolha um horário no futuro", 400);
  if (body.socialAccountId) {
    const acc = await db.socialAccount.findFirst({ where: { id: body.socialAccountId, userId: user!.id } });
    if (!acc) return fail("Conta não encontrada", 404);
    if (acc.platform !== body.platform) return fail("A conta escolhida não é da plataforma selecionada", 400);
  }
  const uniqueIds = [...new Set(body.shortIds)];
  const shorts = await db.short.findMany({ where: { id: { in: uniqueIds }, project: { userId: user!.id } }, select: { id: true, title: true } });
  if (shorts.length !== uniqueIds.length) return fail("Um ou mais cortes não foram encontrados", 404);

  const slots = buildBatchSlots(uniqueIds.length, start, body.intervalHours, body.maxPerDay);
  const siblings = await db.scheduledPost.findMany({
    where: { userId: user!.id, status: { in: ["scheduled", "published"] }, ...(body.socialAccountId ? { socialAccountId: body.socialAccountId } : { socialAccountId: null, platform: body.platform }) },
    select: { scheduledAt: true },
  });
  const err = validateAccountSchedule(siblings.map((s) => s.scheduledAt), slots);
  if (err) return fail(err, 400);

  const byId = new Map(shorts.map((s) => [s.id, s]));
  const created = await db.$transaction(
    uniqueIds.map((shortId, i) =>
      db.scheduledPost.create({
        data: {
          id: newId(),
          userId: user!.id,
          shortId,
          socialAccountId: body.socialAccountId ?? null,
          platform: body.platform,
          caption: body.caption || byId.get(shortId)?.title || "",
          scheduledAt: slots[i],
          status: "scheduled",
        },
      }),
    ),
  );
  await db.short.updateMany({ where: { id: { in: uniqueIds } }, data: { isScheduled: true } });
  return ok({ created: created.length, posts: created, firstAt: slots[0], lastAt: slots[slots.length - 1] }, { status: 201 });
});
