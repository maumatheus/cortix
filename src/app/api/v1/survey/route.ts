import { db } from "@/lib/db";
import { fail, ok, withUser } from "@/lib/api";
import { addCredits } from "@/lib/credits";

export const POST = withUser(async ({ user }) => {
  if (user!.surveyDoneAt) return fail("Você já respondeu a pesquisa", 400);
  await db.user.update({ where: { id: user!.id }, data: { surveyDoneAt: new Date() } });
  await addCredits(user!.id, 60, "survey", "Pesquisa respondida (+60 créditos)");
  return ok({ ok: true, credits: user!.credits + 60 });
});
