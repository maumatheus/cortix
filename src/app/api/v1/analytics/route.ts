import { db } from "@/lib/db";
import { fail, ok, withUser } from "@/lib/api";
import { isSubscriber } from "@/lib/auth";
import { publishDuePosts } from "@/lib/publisher";

/** Métricas reais calculadas a partir do banco (sem dados inventados). */
export const GET = withUser(async ({ user }) => {
  if (!isSubscriber(user!)) return fail("O Analytics requer um plano ativo", 403, { paywall: true });
  await publishDuePosts(user!.id);
  const uid = user!.id;
  const now = Date.now();
  const since = new Date(now - 56 * 86400_000);

  const [projects, shorts, renders, posts, accounts, launcherItems] = await Promise.all([
    db.project.findMany({ where: { userId: uid }, select: { id: true, status: true, createdAt: true, durationSec: true, creditsCharged: true, isFree: true, platform: true } }),
    db.short.findMany({
      where: { project: { userId: uid } },
      select: { id: true, title: true, score: true, status: true, thumbnailUrl: true, renderUrl: true, startTime: true, endTime: true, isPublished: true, isScheduled: true, isInLauncher: true, projectId: true, createdAt: true, project: { select: { title: true } } },
    }),
    db.render.findMany({ where: { userId: uid }, select: { status: true, createdAt: true, durationSec: true } }),
    db.scheduledPost.findMany({ where: { userId: uid }, select: { platform: true, status: true, scheduledAt: true, createdAt: true } }),
    db.socialAccount.findMany({ where: { userId: uid, purpose: "publish" }, select: { platform: true, handle: true } }),
    db.launcherItem.findMany({ where: { launcher: { userId: uid } }, select: { status: true } }),
  ]);

  const avgScore = shorts.length ? shorts.reduce((a, s) => a + s.score, 0) / shorts.length : 0;
  const bestClips = [...shorts]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((s) => ({ id: s.id, title: s.title, score: s.score, thumbnailUrl: s.thumbnailUrl, projectId: s.projectId, projectTitle: s.project.title, duration: s.endTime - s.startTime, status: s.status, isPublished: s.isPublished }));

  // últimas 8 semanas: projetos e cortes criados
  const weeks: Array<{ label: string; projects: number; shorts: number; posts: number }> = [];
  for (let w = 7; w >= 0; w--) {
    const start = new Date(now - (w + 1) * 7 * 86400_000);
    const end = new Date(now - w * 7 * 86400_000);
    weeks.push({
      label: start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      projects: projects.filter((p) => p.createdAt >= start && p.createdAt < end).length,
      shorts: shorts.filter((s) => s.createdAt >= start && s.createdAt < end).length,
      posts: posts.filter((p) => p.status === "published" && p.scheduledAt >= start && p.scheduledAt < end).length,
    });
  }

  const byPlatform = ["youtube", "instagram", "tiktok"].map((platform) => ({
    platform,
    scheduled: posts.filter((p) => p.platform === platform && p.status === "scheduled").length,
    published: posts.filter((p) => p.platform === platform && p.status === "published").length,
    accounts: accounts.filter((a) => a.platform === platform).length,
  }));

  const scoreBuckets = [
    { label: "9–10", min: 9, max: 10.01 },
    { label: "8–9", min: 8, max: 9 },
    { label: "7–8", min: 7, max: 8 },
    { label: "6–7", min: 6, max: 7 },
    { label: "< 6", min: -1, max: 6 },
  ].map((b) => ({ label: b.label, count: shorts.filter((s) => s.score >= b.min && s.score < b.max).length }));

  const minutesAnalyzed = projects.reduce((a, p) => a + p.durationSec / 60, 0);

  return ok({
    since,
    totals: {
      projects: projects.length,
      projectsReady: projects.filter((p) => p.status === "ready").length,
      shorts: shorts.length,
      rendered: shorts.filter((s) => s.status === "rendered").length,
      renders: renders.length,
      rendersDone: renders.filter((r) => r.status === "done").length,
      scheduled: posts.filter((p) => p.status === "scheduled").length,
      published: posts.filter((p) => p.status === "published").length,
      inLauncher: launcherItems.filter((i) => i.status !== "posted").length,
      accounts: accounts.length,
      avgScore: Math.round(avgScore * 10) / 10,
      minutesAnalyzed: Math.round(minutesAnalyzed),
      creditsSpent: projects.reduce((a, p) => a + p.creditsCharged, 0),
    },
    weeks,
    byPlatform,
    scoreBuckets,
    bestClips,
    accounts,
  });
});
