import { db } from "./db";
import { cpmEarnings, maskName, prizeForPosition } from "./championships";

/** Requisitos para participar: chave PIX e ao menos uma conta social com purpose "championship". */
export async function getChampionshipRequirements(user: { id: string; pixKey: string | null }) {
  const accounts = await db.socialAccount.count({ where: { userId: user.id, purpose: "championship" } });
  return { pixKey: !!user.pixKey && user.pixKey.trim().length > 0, socialAccount: accounts > 0 };
}

export type EntryLite = { championshipId: string; userId: string; views: number };

export interface ChampionshipStats {
  participants: number;
  videos: number;
  views: number;
  joined: boolean;
}

/** Agrega participantes (usuários distintos), vídeos e views por campeonato. */
export function aggregateStats(entries: EntryLite[], currentUserId: string): Map<string, ChampionshipStats> {
  const map = new Map<string, ChampionshipStats & { users: Set<string> }>();
  for (const e of entries) {
    let s = map.get(e.championshipId);
    if (!s) {
      s = { participants: 0, videos: 0, views: 0, joined: false, users: new Set() };
      map.set(e.championshipId, s);
    }
    s.users.add(e.userId);
    s.videos += 1;
    s.views += e.views;
    if (e.userId === currentUserId) s.joined = true;
  }
  const out = new Map<string, ChampionshipStats>();
  for (const [id, s] of map) out.set(id, { participants: s.users.size, videos: s.videos, views: s.views, joined: s.joined });
  return out;
}

export interface RankingRow {
  position: number;
  name: string;
  isMe: boolean;
  views: number;
  videos: number;
  qualified: boolean;
  prize: number;
}

/** Ranking por usuário (soma de views), com nomes mascarados e prêmio estimado. */
export function buildRanking(
  entries: { userId: string; views: number; user: { name: string } }[],
  champ: { kind: string; prizeTotal: number; ratePer1000: number | null; minViews: number },
  currentUserId: string,
  limit = 15,
): RankingRow[] {
  const byUser = new Map<string, { name: string; views: number; videos: number }>();
  for (const e of entries) {
    const cur = byUser.get(e.userId) || { name: e.user.name, views: 0, videos: 0 };
    cur.views += e.views;
    cur.videos += 1;
    byUser.set(e.userId, cur);
  }
  return [...byUser.entries()]
    .sort((a, b) => b[1].views - a[1].views || b[1].videos - a[1].videos)
    .slice(0, limit)
    .map(([userId, u], i) => {
      const position = i + 1;
      const qualified = champ.kind === "cpm" ? true : u.views >= champ.minViews;
      const prize = champ.kind === "cpm" ? cpmEarnings(u.views, champ.ratePer1000) : qualified ? prizeForPosition(position, champ.prizeTotal) : 0;
      return { position, name: userId === currentUserId ? u.name : maskName(u.name), isMe: userId === currentUserId, views: u.views, videos: u.videos, qualified, prize };
    });
}
