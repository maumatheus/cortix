import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { fail, ok, withUser } from "@/lib/api";
import { addCredits } from "@/lib/credits";
import { assertSubscriber, dayKey, yesterdayKey } from "@/lib/quests";

export const POST = withUser(async ({ user }) => {
  assertSubscriber(user!);
  const now = new Date();
  const today = dayKey(now);

  const mission = await db.mission.findUnique({ where: { key: "checkin" } });
  if (!mission) return fail("Missão de check-in não configurada. Rode o seed.", 500);

  const already = await db.missionCompletion.findUnique({ where: { userId_missionId_dayKey: { userId: user!.id, missionId: mission.id, dayKey: today } } });
  if (already) return fail("Você já fez o check-in de hoje. Volte amanhã!", 400);

  const lastKey = user!.lastCheckinAt ? dayKey(user!.lastCheckinAt) : null;
  const streak = lastKey === yesterdayKey(now) ? user!.streak + 1 : 1;

  await db.$transaction([
    db.user.update({ where: { id: user!.id }, data: { streak, lastCheckinAt: now } }),
    db.missionCompletion.create({ data: { id: newId(), userId: user!.id, missionId: mission.id, dayKey: today } }),
  ]);
  await addCredits(user!.id, mission.reward, "checkin", `Check-in diário · dia ${streak} da sequência (+${mission.reward} créditos)`, mission.id);

  let streakBonus: number | null = null;
  if (streak >= 7) {
    const s7 = await db.mission.findUnique({ where: { key: "streak7" } });
    if (s7) {
      const got = await db.missionCompletion.findUnique({ where: { userId_missionId_dayKey: { userId: user!.id, missionId: s7.id, dayKey: "" } } });
      if (!got) {
        await db.missionCompletion.create({ data: { id: newId(), userId: user!.id, missionId: s7.id, dayKey: "" } });
        await addCredits(user!.id, s7.reward, "mission", `Missão concluída: ${s7.title} (+${s7.reward} créditos)`, s7.id);
        streakBonus = s7.reward;
      }
    }
  }

  const fresh = await db.user.findUnique({ where: { id: user!.id }, select: { credits: true } });
  return ok({ ok: true, reward: mission.reward, streak, streakBonus, credits: fresh?.credits ?? user!.credits + mission.reward });
});
