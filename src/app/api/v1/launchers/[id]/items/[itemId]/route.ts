import { db } from "@/lib/db";
import { fail, ok, withUser } from "@/lib/api";
import { launcherInclude, serializeLauncher } from "@/lib/launchers";

export const DELETE = withUser(async ({ params, user }) => {
  const item = await db.launcherItem.findFirst({ where: { id: params.itemId, launcherId: params.id, launcher: { userId: user!.id } } });
  if (!item) return fail("Item não encontrado", 404);
  await db.launcherItem.delete({ where: { id: item.id } });
  const still = await db.launcherItem.count({ where: { shortId: item.shortId, status: { not: "posted" } } });
  if (still === 0) await db.short.update({ where: { id: item.shortId }, data: { isInLauncher: false } }).catch(() => null);
  const updated = await db.launcher.findFirst({ where: { id: params.id }, include: launcherInclude });
  return ok({ ok: true, launcher: updated ? serializeLauncher(updated) : null });
});
