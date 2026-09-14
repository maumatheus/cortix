import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, readJson, withUser } from "@/lib/api";
import { newId } from "@/lib/ids";
import { nextSlot, parseTimes } from "@/lib/launcher-slots";
import { launcherInclude, serializeLauncher } from "@/lib/launchers";

const schema = z.object({ shortId: z.string().optional(), shortIds: z.array(z.string()).optional() });

/** Adiciona um corte (ou vários) à fila e calcula o próximo horário livre do launcher. */
export const POST = withUser(async ({ req, params, user }) => {
  const body = schema.parse(await readJson(req));
  const ids = [...new Set([...(body.shortId ? [body.shortId] : []), ...(body.shortIds ?? [])])].filter(Boolean);
  if (!ids.length) return fail("Informe o corte", 422);
  const l = await db.launcher.findFirst({ where: { id: params.id, userId: user!.id }, include: { items: true } });
  if (!l) return fail("Launcher não encontrado", 404);
  const shorts = await db.short.findMany({ where: { id: { in: ids }, project: { userId: user!.id } }, select: { id: true } });
  if (shorts.length !== ids.length) return fail("Corte não encontrado", 404);

  const times = parseTimes(l.times);
  const pending = l.items.filter((i) => i.status !== "posted");
  let cursor = pending.reduce<Date>((acc, i) => (i.postAt && i.postAt > acc ? i.postAt : acc), new Date());
  let position = l.items.reduce((m, i) => Math.max(m, i.position), 0);
  const created = [];
  for (const sid of ids) {
    if (l.items.some((i) => i.shortId === sid && i.status !== "posted")) continue; // já está na fila
    const slot = nextSlot(times, cursor);
    cursor = slot ?? cursor;
    position += 1;
    const item = await db.launcherItem.create({ data: { id: newId(), launcherId: l.id, shortId: sid, position, status: slot ? "scheduled" : "queued", postAt: slot } });
    await db.short.update({ where: { id: sid }, data: { isInLauncher: true } });
    created.push(item);
  }
  const updated = await db.launcher.findFirst({ where: { id: l.id }, include: launcherInclude });
  return ok({ added: created.length, items: created, launcher: serializeLauncher(updated!) }, { status: 201 });
});
