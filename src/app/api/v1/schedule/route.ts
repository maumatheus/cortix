import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, readJson, withUser } from "@/lib/api";
import { newId } from "@/lib/ids";
import { publishDuePosts } from "@/lib/publisher";
import { accountKey, validateAccountSchedule } from "@/lib/schedule-rules";

const createSchema = z.object({
  shortId: z.string().optional().nullable(),
  socialAccountId: z.string().optional().nullable(),
  platform: z.enum(["tiktok", "instagram", "youtube"]),
  caption: z.string().max(2200).default(""),
  scheduledAt: z.string().min(1, "Informe a data e hora"),
});

const include = {
  short: { select: { id: true, title: true, thumbnailUrl: true, renderUrl: true, status: true, projectId: true, project: { select: { title: true } } } },
  socialAccount: { select: { id: true, platform: true, handle: true } },
};

export const GET = withUser(async ({ req, user }) => {
  await publishDuePosts(user!.id);
  const u = new URL(req.url);
  const from = u.searchParams.get("from");
  const to = u.searchParams.get("to");
  const fromD = from ? new Date(from) : null;
  const toD = to ? new Date(to) : null;
  const where = {
    userId: user!.id,
    ...(fromD && !isNaN(fromD.getTime()) ? { scheduledAt: { gte: fromD, ...(toD && !isNaN(toD.getTime()) ? { lte: toD } : {}) } } : toD && !isNaN(toD.getTime()) ? { scheduledAt: { lte: toD } } : {}),
  };
  const [posts, counts] = await Promise.all([
    db.scheduledPost.findMany({ where, orderBy: { scheduledAt: "asc" }, include }),
    db.scheduledPost.groupBy({ by: ["status"], where: { userId: user!.id }, _count: true }),
  ]);
  const stats = Object.fromEntries(counts.map((c) => [c.status, c._count])) as Record<string, number>;
  return ok({ data: posts, stats: { scheduled: stats.scheduled || 0, published: stats.published || 0, failed: stats.failed || 0, canceled: stats.canceled || 0 } });
});

export const POST = withUser(async ({ req, user }) => {
  const body = createSchema.parse(await readJson(req));
  const when = new Date(body.scheduledAt);
  if (isNaN(when.getTime())) return fail("Data inválida", 422);
  if (when.getTime() < Date.now() - 60_000) return fail("Escolha um horário no futuro", 400);

  let account = null;
  if (body.socialAccountId) {
    account = await db.socialAccount.findFirst({ where: { id: body.socialAccountId, userId: user!.id } });
    if (!account) return fail("Conta não encontrada", 404);
    if (account.platform !== body.platform) return fail("A conta escolhida não é da plataforma selecionada", 400);
  }
  if (body.shortId) {
    const short = await db.short.findFirst({ where: { id: body.shortId, project: { userId: user!.id } } });
    if (!short) return fail("Corte não encontrado", 404);
  }

  // regras por conta: 3 posts / 24h e 2h de intervalo
  const key = accountKey(body.socialAccountId, body.platform);
  const siblings = await db.scheduledPost.findMany({
    where: { userId: user!.id, status: { in: ["scheduled", "published"] }, ...(body.socialAccountId ? { socialAccountId: body.socialAccountId } : { socialAccountId: null, platform: body.platform }) },
    select: { scheduledAt: true },
  });
  const err = validateAccountSchedule(siblings.map((s) => s.scheduledAt), [when]);
  if (err) return fail(err, 400, { rule: key });

  const post = await db.scheduledPost.create({
    data: { id: newId(), userId: user!.id, shortId: body.shortId ?? null, socialAccountId: body.socialAccountId ?? null, platform: body.platform, caption: body.caption, scheduledAt: when, status: "scheduled" },
    include,
  });
  if (body.shortId) await db.short.update({ where: { id: body.shortId }, data: { isScheduled: true } });
  return ok({ post }, { status: 201 });
});
