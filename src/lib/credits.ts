import { db } from "./db";
import { newId } from "./ids";

export type TxType = "purchase" | "plan" | "referral" | "checkin" | "mission" | "survey" | "usage" | "refund" | "spin" | "bonus";

export async function addCredits(userId: string, amount: number, type: TxType, description: string, refId?: string) {
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { credits: { increment: amount } } }),
    db.creditTransaction.create({ data: { id: newId(), userId, amount, type, description, refId } }),
  ]);
}

/** Custo em créditos: 1 crédito por minuto de vídeo analisado (arredondado para cima). */
export function projectCost(startSec: number, endSec: number) {
  const minutes = Math.max(1, Math.ceil((endSec - startSec) / 60));
  return minutes;
}

export async function chargeCredits(userId: string, amount: number, description: string, refId?: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Usuário não encontrado");
  if (user.credits < amount) {
    const err = new Error(`Créditos insuficientes: você tem ${user.credits} e precisa de ${amount}.`) as Error & { status: number };
    err.status = 402;
    throw err;
  }
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { credits: { decrement: amount } } }),
    db.creditTransaction.create({ data: { id: newId(), userId, amount: -amount, type: "usage", description, refId } }),
  ]);
}

export async function refundCredits(userId: string, amount: number, description: string, refId?: string) {
  if (amount <= 0) return;
  await addCredits(userId, amount, "refund", description, refId);
}
