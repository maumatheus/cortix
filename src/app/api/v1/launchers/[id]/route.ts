import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, readJson, withUser } from "@/lib/api";
import { nextSlot, parseTimes } from "@/lib/launcher-slots";
import { launcherInclude, serializeLauncher } from "@/lib/launchers";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  platforms: z.array(z.enum(["tiktok", "instagram", "youtube"])).min(1).optional(),
  times: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1).max(12).optional(),
  status: z.enum(["active", "paused"]).optional(),
});

export const GET = withUser(async ({ params, user }) => {
  const l = await db.launcher.findFirst({ where: { id: params.id, userId: user!.id }, include: launcherInclude });
  if (!l) return fail("Launcher não encontrado", 404);
  return ok({ launcher: serializeLauncher(l) });
});

export const PATCH = withUser(async ({ req, params, user }) => {
  const body = patchSchema.parse(await readJson(req));
  const l = await db.launcher.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!l) return fail("Launcher não encontrado", 404);
  const times = body.times ? [...new Set(body.times)].sort() : undefined;
  await db.launcher.update({
    where: { id: l.id },
    data: { name: body.name, status: body.status, platforms: body.platforms ? JSON.stringify([...new Set(body.platforms)]) : undefined, times: times ? JSON.stringify(times) : undefined },
  });
  // horários mudaram: recalcula a fila pendente
  if (times) {
    const pending = await db.launcherItem.findMany({ where: { launcherId: l.id, status: { not: "posted" } }, orderBy: { position: "asc" } });
    let cursor = new Date();
    for (const it of pending) {
      const slot = nextSlot(parseTimes(JSON.stringify(times)), cursor);
      if (!slot) break;
      await db.launcherItem.update({ where: { id: it.id }, data: { postAt: slot, status: "scheduled" } });
      cursor = slot;
    }
  }
  const updated = await db.launcher.findFirst({ where: { id: l.id }, include: launcherInclude });
  return ok({ launcher: serializeLauncher(updated!) });
});

export const DELETE = withUser(async ({ params, user }) => {
  const l = await db.launcher.findFirst({ where: { id: params.id, userId: user!.id }, include: { items: { select: { shortId: true, status: true } } } });
  if (!l) return fail("Launcher não encontrado", 404);
  await db.launcher.delete({ where: { id: l.id } });
  const shortIds = l.items.map((i) => i.shortId);
  for (const sid of shortIds) {
    const still = await db.launcherItem.count({ where: { shortId: sid } });
    if (still === 0) await db.short.update({ where: { id: sid }, data: { isInLauncher: false } }).catch(() => null);
  }
  return ok({ ok: true });
});
