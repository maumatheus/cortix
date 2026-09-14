import { db } from "./db";
import { isSubscriber } from "./auth";

export const TZ = "America/Sao_Paulo";
export const SPIN_REWARDS = [5, 10, 15, 20, 30, 60];
export const SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Chave do dia (YYYY-MM-DD) no fuso de Brasília. */
export function dayKey(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: TZ });
}

export function yesterdayKey(date: Date = new Date()): string {
  return dayKey(new Date(date.getTime() - 86_400_000));
}

/** Sequência efetiva: zera se o último check-in não foi hoje nem ontem. */
export function effectiveStreak(user: { streak: number; lastCheckinAt: Date | null }, now = new Date()): number {
  if (!user.lastCheckinAt) return 0;
  const last = dayKey(user.lastCheckinAt);
  if (last === dayKey(now) || last === yesterdayKey(now)) return user.streak;
  return 0;
}

export function canSpinAt(lastSpinAt: Date | null, now = new Date()): { canSpin: boolean; nextSpinAt: Date | null } {
  if (!lastSpinAt) return { canSpin: true, nextSpinAt: null };
  const next = new Date(lastSpinAt.getTime() + SPIN_COOLDOWN_MS);
  return { canSpin: next.getTime() <= now.getTime(), nextSpinAt: next };
}

export function assertSubscriber(user: { plan: string | null; planRenewsAt: Date | null }) {
  if (!isSubscriber(user)) {
    const err = new Error("Exclusivo para assinantes") as Error & { status: number };
    err.status = 403;
    throw err;
  }
}

/** Progresso das missões únicas verificado no servidor. */
export async function missionProgress(userId: string): Promise<Record<string, { current: number; target: number }>> {
  const [projects, renders, brandKits, referrals, forumPosts, scheduled] = await Promise.all([
    db.project.count({ where: { userId } }),
    db.render.count({ where: { userId, status: "done" } }),
    db.brandKit.count({ where: { userId } }),
    db.referral.count({ where: { referrerId: userId } }),
    db.forumPost.count({ where: { userId } }),
    db.scheduledPost.count({ where: { userId } }),
  ]);
  return {
    first_project: { current: Math.min(1, projects), target: 1 },
    first_render: { current: Math.min(1, renders), target: 1 },
    brand_kit: { current: Math.min(1, brandKits), target: 1 },
    invite: { current: Math.min(1, referrals), target: 1 },
    forum_post: { current: Math.min(1, forumPosts), target: 1 },
    schedule: { current: Math.min(1, scheduled), target: 1 },
  };
}
