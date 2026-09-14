import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, readJson, withUser } from "@/lib/api";
import { validateAccountSchedule } from "@/lib/schedule-rules";

const patchSchema = z.object({
  caption: z.string().max(2200).optional(),
  scheduledAt: z.string().optional(),
  socialAccountId: z.string().optional().nullable(),
  platform: z.enum(["tiktok", "instagram", "youtube"]).optional(),
  status: z.enum(["scheduled", "canceled"]).optional(),
});

const include = {
  short: { select: { id: true, title: true, thumbnailUrl: true, renderUrl: true, status: true, projectId: true, project: { select: { title: true } } } },
  socialAccount: { select: { id: true, platform: true, handle: true } },
};

export const PATCH = withUser(async ({ req, params, user }) => {
  const body = patchSchema.parse(await readJson(req));
  const post = await db.scheduledPost.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!post) return fail("Post não encontrado", 404);
  if (post.status === "published") return fail("Post já publicado não pode ser alterado", 400);

  const platform = body.platform ?? post.platform;
  const socialAccountId = body.socialAccountId === undefined ? post.socialAccountId : body.socialAccountId;
  let when = post.scheduledAt;
  if (body.scheduledAt) {
    when = new Date(body.scheduledAt);
    if (isNaN(when.getTime())) return fail("Data inválida", 422);
    if (when.getTime() < Date.now() - 60_000) return fail("Escolha um horário no futuro", 400);
  }
  if (socialAccountId) {
    const acc = await db.socialAccount.findFirst({ where: { id: socialAccountId, userId: user!.id } });
    if (!acc) return fail("Conta não encontrada", 404);
    if (acc.platform !== platform) return fail("A conta escolhida não é da plataforma selecionada", 400);
  }
  const nextStatus = body.status ?? post.status;
  if (nextStatus === "scheduled") {
    const siblings = await db.scheduledPost.findMany({
      where: { userId: user!.id, id: { not: post.id }, status: { in: ["scheduled", "published"] }, ...(socialAccountId ? { socialAccountId } : { socialAccountId: null, platform }) },
      select: { scheduledAt: true },
    });
    const err = validateAccountSchedule(siblings.map((s) => s.scheduledAt), [when]);
    if (err) return fail(err, 400);
  }
  const updated = await db.scheduledPost.update({
    where: { id: post.id },
    data: { caption: body.caption, scheduledAt: when, socialAccountId, platform, status: nextStatus },
    include,
  });
  if (post.shortId) await db.short.update({ where: { id: post.shortId }, data: { isScheduled: nextStatus === "scheduled" } });
  return ok({ post: updated });
});

export const DELETE = withUser(async ({ params, user }) => {
  const post = await db.scheduledPost.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!post) return fail("Post não encontrado", 404);
  await db.scheduledPost.delete({ where: { id: post.id } });
  if (post.shortId) {
    const remaining = await db.scheduledPost.count({ where: { shortId: post.shortId, status: "scheduled" } });
    if (remaining === 0) await db.short.update({ where: { id: post.shortId }, data: { isScheduled: false } });
  }
  return ok({ ok: true });
});
