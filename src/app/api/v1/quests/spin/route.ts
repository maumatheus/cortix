import { db } from "@/lib/db";
import { fail, ok, withUser } from "@/lib/api";
import { addCredits } from "@/lib/credits";
import { assertSubscriber, canSpinAt, SPIN_REWARDS } from "@/lib/quests";

export const POST = withUser(async ({ user }) => {
  assertSubscriber(user!);
  const now = new Date();
  const { canSpin, nextSpinAt } = canSpinAt(user!.lastSpinAt, now);
  if (!canSpin && nextSpinAt) {
    const mins = Math.max(1, Math.ceil((nextSpinAt.getTime() - now.getTime()) / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return fail(`Você já girou a roleta hoje. Próximo giro em ${h > 0 ? `${h}h ` : ""}${m}min.`, 429, { nextSpinAt });
  }

  const index = Math.floor(Math.random() * SPIN_REWARDS.length);
  const reward = SPIN_REWARDS[index];

  // Atualização condicional evita giro duplo em requisições simultâneas.
  const updated = await db.user.updateMany({
    where: { id: user!.id, lastSpinAt: user!.lastSpinAt },
    data: { lastSpinAt: now },
  });
  if (updated.count === 0) return fail("Você já girou a roleta hoje.", 429);

  await addCredits(user!.id, reward, "spin", `Roleta de prêmios (+${reward} créditos)`);
  const fresh = await db.user.findUnique({ where: { id: user!.id }, select: { credits: true } });
  return ok({ ok: true, reward, index, rewards: SPIN_REWARDS, nextSpinAt: new Date(now.getTime() + 24 * 3600_000), credits: fresh?.credits ?? user!.credits + reward });
});
