import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, readJson, withUser } from "@/lib/api";
import { newId } from "@/lib/ids";

const createSchema = z.object({ name: z.string().trim().min(1, "Dê um nome ao token").max(60).default("Meu assistente") });

function mask(token: string) {
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

export const GET = withUser(async ({ user }) => {
  const tokens = await db.apiToken.findMany({ where: { userId: user!.id }, orderBy: { createdAt: "desc" } });
  return ok({ data: tokens.map((t) => ({ id: t.id, name: t.name, masked: mask(t.token), createdAt: t.createdAt, lastUsedAt: t.lastUsedAt })) });
});

/** Cria um token. O valor completo só é devolvido nesta resposta. */
export const POST = withUser(async ({ req, user }) => {
  const body = createSchema.parse(await readJson(req));
  const count = await db.apiToken.count({ where: { userId: user!.id } });
  if (count >= 10) return fail("Limite de 10 tokens por conta. Revogue um token antigo pra criar outro.", 400);
  const token = `cf_${randomBytes(24).toString("hex")}`;
  const t = await db.apiToken.create({ data: { id: newId(), userId: user!.id, name: body.name, token } });
  return ok({ token: { id: t.id, name: t.name, token, masked: mask(token), createdAt: t.createdAt, lastUsedAt: null } }, { status: 201 });
});
