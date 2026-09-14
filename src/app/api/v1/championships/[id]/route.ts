import { db } from "@/lib/db";
import { fail, ok, withUser } from "@/lib/api";
import { aggregateStats, buildRanking, getChampionshipRequirements } from "@/lib/championships-server";

/** Detalhe do campeonato: dados, meus envios, ranking (nomes mascarados) e requisitos do usuário. */
export const GET = withUser(async ({ params, user }) => {
  const champ = await db.championship.findUnique({ where: { id: params.id } });
  if (!champ) return fail("Campeonato não encontrado", 404);

  const [entries, requirements] = await Promise.all([
    db.championshipEntry.findMany({ where: { championshipId: champ.id }, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } }),
    getChampionshipRequirements(user!),
  ]);

  const stats = aggregateStats(entries, user!.id).get(champ.id) || { participants: 0, videos: 0, views: 0, joined: false };
  const mine = entries
    .filter((e) => e.userId === user!.id)
    .map((e) => ({ id: e.id, videoUrl: e.videoUrl, platform: e.platform, category: e.category, views: e.views, createdAt: e.createdAt }));

  return ok({
    championship: { ...champ, ...stats },
    entries: mine,
    ranking: buildRanking(entries, champ, user!.id),
    requirements,
  });
});
