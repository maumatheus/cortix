import { db } from "@/lib/db";
import { ok, withUser } from "@/lib/api";
import { assertSubscriber, canSpinAt, dayKey, effectiveStreak, missionProgress, SPIN_REWARDS } from "@/lib/quests";

export const GET = withUser(async ({ user }) => {
  assertSubscriber(user!);
  const now = new Date();
  const today = dayKey(now);
  const [missions, completions, progress] = await Promise.all([
    db.mission.findMany({ orderBy: { sortOrder: "asc" } }),
    db.missionCompletion.findMany({ where: { userId: user!.id } }),
    missionProgress(user!.id),
  ]);

  const byMission = new Map<string, typeof completions>();
  for (const c of completions) {
    if (!byMission.has(c.missionId)) byMission.set(c.missionId, []);
    byMission.get(c.missionId)!.push(c);
  }

  const streak = effectiveStreak(user!, now);
  const checkin = missions.find((m) => m.key === "checkin");
  const checkedInToday = !!checkin && (byMission.get(checkin.id) || []).some((c) => c.dayKey === today);

  const data = missions.map((m) => {
    const list = byMission.get(m.id) || [];
    const done = m.kind === "daily" ? list.some((c) => c.dayKey === today) : list.length > 0;
    const prog = m.key === "streak7" ? { current: Math.min(7, streak), target: 7 } : m.key === "checkin" ? { current: done ? 1 : 0, target: 1 } : progress[m.key] || { current: 0, target: 1 };
    const claimable = !done && m.kind === "once" && m.key !== "streak7" && prog.current >= prog.target;
    return {
      id: m.id,
      key: m.key,
      title: m.title,
      description: m.description,
      reward: m.reward,
      kind: m.kind,
      done,
      claimable,
      progress: prog,
      completedAt: m.kind === "once" ? list[0]?.completedAt ?? null : list.find((c) => c.dayKey === today)?.completedAt ?? null,
    };
  });

  const spin = canSpinAt(user!.lastSpinAt, now);
  const checkinDays = completions
    .filter((c) => checkin && c.missionId === checkin.id)
    .map((c) => c.dayKey)
    .sort();

  return ok({
    missions: data,
    checkedInToday,
    streak,
    today,
    checkinDays: checkinDays.slice(-30),
    canSpin: spin.canSpin,
    nextSpinAt: spin.nextSpinAt,
    spinRewards: SPIN_REWARDS,
    credits: user!.credits,
  });
});
