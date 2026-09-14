import { z } from "zod";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { fail, ok, readJson, withUser } from "@/lib/api";
import { getPlan, PACKAGE_MAX, PACKAGE_MIN, packagePriceCents } from "@/lib/plans";

const schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("package"),
    credits: z.number().int().min(PACKAGE_MIN, `Mínimo de ${PACKAGE_MIN} créditos`).max(PACKAGE_MAX, `Máximo de ${PACKAGE_MAX} créditos`),
    method: z.enum(["pix", "card"]),
  }),
  z.object({
    kind: z.literal("plan"),
    planId: z.enum(["lite", "creator", "viral"]),
    cycle: z.enum(["monthly", "yearly"]),
    method: z.enum(["pix", "card"]),
  }),
]);

export const GET = withUser(async ({ req, user }) => {
  const u = new URL(req.url);
  const page = Math.max(1, Number(u.searchParams.get("page")) || 1);
  const limit = Math.min(100, Number(u.searchParams.get("limit")) || 20);
  const status = u.searchParams.get("status");
  const where = { userId: user!.id, ...(status ? { status } : {}) };
  const [total, data] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
  ]);
  return ok({ data, page, limit, total, lastPage: Math.max(1, Math.ceil(total / limit)) });
});

export const POST = withUser(async ({ req, user }) => {
  const body = schema.parse(await readJson(req));

  let amountCents: number;
  let credits: number;
  let planId: string | null = null;
  let cycle: string | null = null;

  if (body.kind === "package") {
    credits = body.credits;
    amountCents = packagePriceCents(credits, body.method);
  } else {
    const plan = getPlan(body.planId);
    if (!plan) return fail("Plano inválido", 400);
    planId = plan.id;
    cycle = body.cycle;
    credits = plan.credits;
    amountCents = body.cycle === "yearly" ? plan.yearlyCents * 12 : plan.monthlyCents;
  }

  const id = newId();
  const pixCode = body.method === "pix" ? fakePixCode(id, amountCents) : null;

  const order = await db.order.create({
    data: { id, userId: user!.id, kind: body.kind, planId, cycle, credits, amountCents, method: body.method, status: "pending", pixCode },
  });

  if (body.method === "card") {
    // Sem chave da Stripe configurada: o checkout é simulado e confirmado via /orders/[id]/confirm.
    return ok({ order, checkoutUrl: `/financeiro?tab=history&card=1&order=${order.id}`, simulated: true });
  }
  return ok({ order, simulated: true });
});

/** Gera um "PIX copia e cola" com aparência de BR Code (EMV). Apenas para simulação. */
function fakePixCode(orderId: string, amountCents: number) {
  const emv = (tag: string, value: string) => `${tag}${String(value.length).padStart(2, "0")}${value}`;
  const txid = orderId.slice(-25).toUpperCase();
  const key = crypto.randomUUID();
  const amount = (amountCents / 100).toFixed(2);
  const merchantInfo = emv("00", "br.gov.bcb.pix") + emv("01", key);
  const additional = emv("05", txid);
  const payload =
    emv("00", "01") +
    emv("26", merchantInfo) +
    emv("52", "0000") +
    emv("53", "986") +
    emv("54", amount) +
    emv("58", "BR") +
    emv("59", "Cortix LTDA") +
    emv("60", "SAO PAULO") +
    emv("62", additional) +
    "6304";
  return payload + crc16(payload);
}

function crc16(input: string) {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
