import { db } from "./db";
import { addCredits } from "./credits";
import { REFERRAL_SHARE } from "./plans";

/**
 * Chamado quando um pedido é pago. Se o usuário foi indicado por alguém e esta é a
 * primeira compra dele, os dois lados recebem 50% dos créditos do plano/pacote.
 * Retorna null quando não há indicação pendente.
 */
export async function awardReferralOnFirstPurchase(userId: string, planCredits: number) {
  const referral = await db.referral.findUnique({ where: { referredId: userId } });
  if (!referral || referral.status === "purchased") return null;
  if (referral.referrerId === userId) return null;

  const share = Math.max(1, Math.round(planCredits * REFERRAL_SHARE));
  const referred = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
  const referrer = await db.user.findUnique({ where: { id: referral.referrerId }, select: { id: true, name: true } });
  if (!referrer) return null;

  await db.referral.update({ where: { id: referral.id }, data: { status: "purchased", creditsAwarded: share } });
  await addCredits(referral.referrerId, share, "referral", `Indicação: ${referred?.name ?? "seu convidado"} fez a primeira compra (+${share} créditos)`, referral.id);
  await addCredits(userId, share, "referral", `Bônus de indicação de ${referrer.name} pela sua primeira compra (+${share} créditos)`, referral.id);

  return { referralId: referral.id, referrerId: referral.referrerId, share };
}

/** "Matheus Fernandes" → "M*** F***" */
export function maskName(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase() + "***")
    .join(" ");
}
