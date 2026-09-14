import { parsePlatforms, parseTimes } from "./launcher-slots";

export const launcherInclude = {
  items: {
    orderBy: [{ status: "asc" as const }, { position: "asc" as const }],
    include: { short: { select: { id: true, title: true, thumbnailUrl: true, renderUrl: true, status: true, projectId: true, project: { select: { title: true } } } } },
  },
};

export function serializeLauncher<T extends { id: string; name: string; platforms: string; times: string; status: string; createdAt: Date; items: Array<{ status: string; postAt: Date | null }> }>(l: T) {
  const queued = l.items.filter((i) => i.status !== "posted");
  const next = queued
    .map((i) => i.postAt)
    .filter((d): d is Date => !!d)
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  return { ...l, platforms: parsePlatforms(l.platforms), times: parseTimes(l.times), queuedCount: queued.length, postedCount: l.items.length - queued.length, nextPostAt: next };
}
