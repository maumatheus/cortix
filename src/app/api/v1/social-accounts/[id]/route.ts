import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, readJson, withUser } from "@/lib/api";

const patchSchema = z.object({
  channel: z.string().trim().toLowerCase().max(40).nullable(),
});

/** Marca a conta com o canal do estúdio (ex.: politica), que liga as regras de schedule-rules. */
export const PATCH = withUser(async ({ req, params, user }) => {
  const body = patchSchema.parse(await readJson(req));
  const account = await db.socialAccount.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!account) return fail("Conta não encontrada", 404);
  const updated = await db.socialAccount.update({ where: { id: account.id }, data: { channel: body.channel || null }, select: { id: true, platform: true, handle: true, channel: true } });
  return ok({ account: updated });
});

export const DELETE = withUser(async ({ params, user }) => {
  const account = await db.socialAccount.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!account) return fail("Conta não encontrada", 404);
  await db.socialAccount.delete({ where: { id: account.id } });
  return ok({ ok: true });
});
