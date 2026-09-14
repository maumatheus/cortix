/** Helpers compartilhados (servidor + cliente) dos campeonatos. */

export const PLATFORMS = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
] as const;
export type Platform = (typeof PLATFORMS)[number]["value"];
export const PLATFORM_VALUES = PLATFORMS.map((p) => p.value) as [Platform, ...Platform[]];

const PLATFORM_HOSTS: Record<Platform, string[]> = {
  tiktok: ["tiktok.com"],
  instagram: ["instagram.com"],
  youtube: ["youtube.com", "youtu.be"],
};

export function platformLabel(p: string): string {
  return PLATFORMS.find((x) => x.value === p)?.label ?? p;
}

/** Confere se o host da URL pertence à plataforma informada. */
export function urlMatchesPlatform(url: string, platform: Platform): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PLATFORM_HOSTS[platform].some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

export type ChampionshipStatus = "active" | "budget_exhausted" | "finished";
export type ChampionshipKind = "cpm" | "ranking";

export const STATUS_LABELS: Record<ChampionshipStatus, string> = {
  active: "Ativo",
  budget_exhausted: "Orçamento esgotado",
  finished: "Finalizado",
};

export function statusLabel(s: string): string {
  return (STATUS_LABELS as Record<string, string>)[s] ?? s;
}

/** Tabela padrão de premiação por ranking (percentual do prêmio total). */
export const PRIZE_TABLE: { position: number; pct: number }[] = [
  { position: 1, pct: 25 },
  { position: 2, pct: 18 },
  { position: 3, pct: 14 },
  { position: 4, pct: 11 },
  { position: 5, pct: 9 },
  { position: 6, pct: 7.5 },
  { position: 7, pct: 6 },
  { position: 8, pct: 4.5 },
  { position: 9, pct: 3 },
  { position: 10, pct: 2 },
];

/** Prêmio (em centavos) para uma posição do ranking. */
export function prizeForPosition(position: number, prizeTotalCents: number): number {
  const row = PRIZE_TABLE.find((r) => r.position === position);
  return row ? Math.round((prizeTotalCents * row.pct) / 100) : 0;
}

/** Ganho estimado (centavos) em campeonatos pagos por views. */
export function cpmEarnings(views: number, ratePer1000: number | null): number {
  if (!ratePer1000) return 0;
  return Math.floor(views / 1000) * ratePer1000;
}

/** "Matheus Hack" → "Ma***s H." */
export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] || "Creator";
  const masked = first.length <= 2 ? first[0] + "***" : first.slice(0, 2) + "***" + first.slice(-1);
  const last = parts.length > 1 ? ` ${parts[parts.length - 1][0].toUpperCase()}.` : "";
  return masked + last;
}

export function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const RANKING_CATEGORIES = [
  { value: "clip", label: "CLIP (corte)" },
  { value: "edit", label: "EDIT (edição)" },
] as const;

/** Bloco padrão de regras exibido em todos os campeonatos. */
export const STANDARD_RULES: { title: string; text: string }[] = [
  {
    title: "Conteúdo roubado não pontua",
    text: "Cortes copiados de outros clipadores, repostados ou baixados de terceiros são desclassificados. Vale apenas conteúdo produzido por você a partir do material oficial do campeonato.",
  },
  {
    title: "Views válidas",
    text: "Contam apenas views orgânicas ganhas depois do envio do vídeo. Views compradas, bots ou impulsionamento pago zeram a contagem e podem banir a conta do campeonato.",
  },
  {
    title: "Conta vinculada",
    text: "O vídeo precisa estar publicado em uma das contas cadastradas em Contas conectadas. Vídeos em contas não vinculadas não são contabilizados.",
  },
  {
    title: "Formato e hashtags",
    text: "Formato vertical 9:16, com a hashtag #cortix na legenda e marcação do perfil oficial do organizador quando exigido na descrição.",
  },
  {
    title: "Pagamento",
    text: "Prêmios são pagos via PIX na chave cadastrada no seu perfil, no prazo informado pelo organizador após o encerramento da edição.",
  },
];
