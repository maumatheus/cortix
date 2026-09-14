import { db } from "./db";

/**
 * Publicador simulado: marca como "published" os posts cujo horário já passou
 * e sinaliza o corte como publicado. Também dá baixa nos itens de launcher vencidos.
 * Não fala com nenhuma rede social de verdade.
 */
export async function publishDuePosts(userId?: string) {
  const now = new Date();
  const due = await db.scheduledPost.findMany({
    where: { status: "scheduled", scheduledAt: { lte: now }, ...(userId ? { userId } : {}) },
    select: { id: true, shortId: true },
  });
  if (due.length) {
    await db.scheduledPost.updateMany({ where: { id: { in: due.map((p) => p.id) } }, data: { status: "published" } });
    const shortIds = due.map((p) => p.shortId).filter((s): s is string => !!s);
    if (shortIds.length) await db.short.updateMany({ where: { id: { in: shortIds } }, data: { isPublished: true, isScheduled: false } });
  }

  const dueItems = await db.launcherItem.findMany({
    where: { status: { not: "posted" }, postAt: { lte: now }, ...(userId ? { launcher: { userId } } : {}) },
    select: { id: true, shortId: true },
  });
  if (dueItems.length) {
    await db.launcherItem.updateMany({ where: { id: { in: dueItems.map((i) => i.id) } }, data: { status: "posted" } });
    await db.short.updateMany({ where: { id: { in: dueItems.map((i) => i.shortId) } }, data: { isPublished: true } });
  }
  return { posts: due.length, launcherItems: dueItems.length };
}
