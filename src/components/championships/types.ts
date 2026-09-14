import type { ChampionshipKind, ChampionshipStatus } from "@/lib/championships";

export interface Championship {
  id: string;
  title: string;
  organizer: string;
  description: string;
  kind: ChampionshipKind;
  status: ChampionshipStatus;
  startDate: string;
  endDate: string;
  prizeTotal: number;
  ratePer1000: number | null;
  budgetUsedPct: number;
  bannerUrl: string | null;
  minViews: number;
  participants: number;
  videos: number;
  views: number;
  joined: boolean;
}

export interface Requirements {
  pixKey: boolean;
  socialAccount: boolean;
}

export interface ChampionshipAccount {
  id: string;
  platform: string;
  handle: string;
  purpose: string;
  createdAt: string;
}

export interface ChampionshipEntry {
  id: string;
  videoUrl: string;
  platform: string;
  category: string | null;
  views: number;
  createdAt: string;
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

export interface ChampionshipsResponse {
  data: Championship[];
  requirements: Requirements;
}

export interface ChampionshipDetail {
  championship: Championship;
  entries: ChampionshipEntry[];
  ranking: RankingRow[];
  requirements: Requirements;
}

export function requirementsMet(r: Requirements | null | undefined): boolean {
  return !!r && r.pixKey && r.socialAccount;
}
