import { db } from "@/lib/db";
import { fail, ok, readJson, withUser } from "@/lib/api";
import { publishDuePosts } from "@/lib/publisher";
import { createScheduledPost, postInclude, ScheduleError } from "@/lib/schedule";

const include = postInclude;

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
  try {
    const post = await createScheduledPost(user!, await readJson(req));
    return ok({ post }, { status: 201 });
  } catch (e) {
    if (e instanceof ScheduleError) return fail(e.message, e.status, e.extra);
    throw e;
  }
});
