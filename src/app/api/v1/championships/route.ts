import { db } from "@/lib/db";
import { ok, withUser } from "@/lib/api";
import { aggregateStats, getChampionshipRequirements } from "@/lib/championships-server";

/**
 * Lista campeonatos. `status=active` (padrão) | `finished` | `all`.
 * Resposta: `{ data: [...], requirements }` — o dashboard depende de `data[].{id,title,kind,prizeTotal,bannerUrl}`.
 */
export const GET = withUser(async ({ req, user }) => {
  const u = new URL(req.url);
  const status = u.searchParams.get("status") || "active";
  const where = status === "all" ? {} : status === "finished" ? { status: "finished" } : { status: "active" };

  const champs = await db.championship.findMany({ where, orderBy: [{ status: "asc" }, { endDate: "asc" }] });
  const ids = champs.map((c) => c.id);
  const [entries, requirements] = await Promise.all([
    ids.length ? db.championshipEntry.findMany({ where: { championshipId: { in: ids } }, select: { championshipId: true, userId: true, views: true } }) : Promise.resolve([]),
    getChampionshipRequirements(user!),
  ]);
  const stats = aggregateStats(entries, user!.id);

  return ok({
    data: champs.map((c) => {
      const s = stats.get(c.id) || { participants: 0, videos: 0, views: 0, joined: false };
      return { ...c, ...s };
    }),
    requirements,
  });
});
