import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, readJson, withUser } from "@/lib/api";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  channelUrl: z
    .string()
    .trim()
    .refine((v) => /^https?:\/\//i.test(v), "URL inválida")
    .optional(),
  prompt: z.string().trim().max(2000).optional(),
  minScore: z.number().int().min(1).max(10).optional(),
  status: z.enum(["idle", "watching", "live", "stopped"]).optional(),
});

export const GET = withUser(async ({ params, user }) => {
  const m = await db.liveMonitor.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!m) return fail("Monitoramento não encontrado", 404);
  return ok({ monitor: m });
});

export const PATCH = withUser(async ({ req, params, user }) => {
  const body = patchSchema.parse(await readJson(req));
  const m = await db.liveMonitor.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!m) return fail("Monitoramento não encontrado", 404);
  const monitor = await db.liveMonitor.update({ where: { id: m.id }, data: body });
  return ok({ monitor });
});

export const DELETE = withUser(async ({ params, user }) => {
  const m = await db.liveMonitor.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!m) return fail("Monitoramento não encontrado", 404);
  await db.liveMonitor.delete({ where: { id: m.id } });
  return ok({ ok: true });
});
