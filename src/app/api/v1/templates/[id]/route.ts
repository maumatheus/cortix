import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, readJson, withUser } from "@/lib/api";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  config: z.object({ styleId: z.string(), layout: z.string(), font: z.string(), description: z.string().max(200).optional() }).optional(),
  isPublic: z.boolean().optional(),
});

function parse(raw: string) {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export const GET = withUser(async ({ params, user }) => {
  const t = await db.template.findFirst({ where: { id: params.id, OR: [{ userId: user!.id }, { isPublic: true }] } });
  if (!t) return fail("Template não encontrado", 404);
  return ok({ template: { ...t, config: parse(t.config), isMine: t.userId === user!.id } });
});

export const PATCH = withUser(async ({ req, params, user }) => {
  const body = patchSchema.parse(await readJson(req));
  const t = await db.template.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!t) return fail("Template não encontrado", 404);
  const updated = await db.template.update({
    where: { id: t.id },
    data: { name: body.name, isPublic: body.isPublic, config: body.config ? JSON.stringify(body.config) : undefined },
  });
  return ok({ template: { ...updated, config: parse(updated.config), isMine: true } });
});

export const DELETE = withUser(async ({ params, user }) => {
  const t = await db.template.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!t) return fail("Template não encontrado", 404);
  await db.template.delete({ where: { id: t.id } });
  return ok({ ok: true });
});
