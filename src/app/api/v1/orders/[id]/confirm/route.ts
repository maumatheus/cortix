import { db } from "@/lib/db";
import { fail, ok, withUser } from "@/lib/api";
import { addCredits } from "@/lib/credits";
import { getPlan } from "@/lib/plans";
import { awardReferralOnFirstPurchase } from "@/lib/referrals";

/**
 * Confirmação SIMULADA de pagamento (sem gateway). Em produção, desligue com
 * ALLOW_MOCK_PAYMENTS=false e confirme pedidos pelo webhook do gateway (Stripe / PSP de PIX).
 */
export const POST = withUser(async ({ params, user }) => {
  if (process.env.ALLOW_MOCK_PAYMENTS === "false") return fail("Confirmação manual desativada. Aguarde a confirmação do pagamento.", 403);
  const order = await db.order.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!order) return fail("Pedido não encontrado", 404);
  if (order.status === "paid") return ok({ order, alreadyPaid: true });
  if (order.status !== "pending") return fail("Este pedido não pode ser confirmado", 400);

  // transição condicional: evita crédito em dobro se confirmarem duas vezes ao mesmo tempo
  const moved = await db.order.updateMany({ where: { id: order.id, status: "pending" }, data: { status: "paid", paidAt: new Date() } });
  if (moved.count === 0) return fail("Pedido já processado", 409);

  if (order.kind === "package") {
    await addCredits(user!.id, order.credits, "purchase", `Recarga de ${order.credits} créditos via ${order.method === "pix" ? "Pix" : "Cartão"}`, order.id);
  } else {
    const plan = getPlan(order.planId);
    if (!plan) return fail("Plano inválido", 400);
    const days = order.cycle === "yearly" ? 365 : 30;
    await db.user.update({
      where: { id: user!.id },
      data: { plan: plan.id, planCycle: order.cycle || "monthly", planRenewsAt: new Date(Date.now() + days * 86400_000) },
    });
    await addCredits(user!.id, plan.credits, "plan", `Assinatura ${plan.name} (${order.cycle === "yearly" ? "anual" : "mensal"}): +${plan.credits} créditos`, order.id);
  }

  const referral = await awardReferralOnFirstPurchase(user!.id, order.credits);
  const paid = await db.order.findUnique({ where: { id: order.id } });
  const fresh = await db.user.findUnique({ where: { id: user!.id }, select: { credits: true, plan: true, planRenewsAt: true } });
  return ok({ order: paid, user: fresh, referral });
});
