import { z } from "zod";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { fail, ok, readJson, withUser } from "@/lib/api";
import { addCredits } from "@/lib/credits";
import { assertSubscriber, missionProgress } from "@/lib/quests";

const CLAIMABLE = ["first_project", "first_render", "brand_kit", "invite", "forum_post", "schedule"] as const;

const schema = z.object({ key: z.enum(CLAIMABLE) });

export const POST = withUser(async ({ req, user }) => {
  assertSubscriber(user!);
  const { key } = schema.parse(await readJson(req));

  const mission = await db.mission.findUnique({ where: { key } });
  if (!mission || mission.kind !== "once") return fail("Missão não encontrada", 404);

  const done = await db.missionCompletion.findUnique({ where: { userId_missionId_dayKey: { userId: user!.id, missionId: mission.id, dayKey: "" } } });
  if (done) return fail("Você já resgatou esta missão", 400);

  const progress = await missionProgress(user!.id);
  const p = progress[key];
  if (!p || p.current < p.target) return fail("Você ainda não concluiu esta missão", 400);

  await db.missionCompletion.create({ data: { id: newId(), userId: user!.id, missionId: mission.id, dayKey: "" } });
  await addCredits(user!.id, mission.reward, "mission", `Missão concluída: ${mission.title} (+${mission.reward} créditos)`, mission.id);

  const fresh = await db.user.findUnique({ where: { id: user!.id }, select: { credits: true } });
  return ok({ ok: true, key, reward: mission.reward, credits: fresh?.credits ?? user!.credits + mission.reward });
});
