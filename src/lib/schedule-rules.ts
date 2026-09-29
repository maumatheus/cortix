export const MAX_POSTS_PER_DAY = 3;
export const MIN_GAP_HOURS = 2;

const DAY = 24 * 3600_000;
const GAP = MIN_GAP_HOURS * 3600_000;

/**
 * Valida a agenda de uma conta: no máximo 3 posts em qualquer janela de 24h
 * e pelo menos 2h entre posts consecutivos. Devolve a mensagem do erro ou null.
 */
export function validateAccountSchedule(existing: Date[], incoming: Date[]): string | null {
  const times = [...existing.map((d) => d.getTime()), ...incoming.map((d) => d.getTime())].sort((a, b) => a - b);
  for (let i = 1; i < times.length; i++) {
    if (times[i] - times[i - 1] < GAP) {
      return `Intervalo mínimo de ${MIN_GAP_HOURS} horas entre posts da mesma conta. Já existe um post às ${fmt(times[i - 1])}; escolha um horário a partir de ${fmt(times[i - 1] + GAP)}.`;
    }
  }
  for (let i = 0; i + MAX_POSTS_PER_DAY < times.length; i++) {
    if (times[i + MAX_POSTS_PER_DAY] - times[i] < DAY) {
      return `Limite de ${MAX_POSTS_PER_DAY} posts por conta em 24 horas atingido entre ${fmt(times[i])} e ${fmt(times[i + MAX_POSTS_PER_DAY])}. Escolha outro dia ou outra conta.`;
    }
  }
  return null;
}

function fmt(ms: number) {
  return new Date(ms).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Chave que identifica "a mesma conta": id da conta conectada ou, sem conta, a plataforma. */
export function accountKey(socialAccountId: string | null | undefined, platform: string) {
  return socialAccountId ? `acc:${socialAccountId}` : `platform:${platform}`;
}

/** Gera os horários de um lote respeitando intervalo e máximo por dia. */
export function buildBatchSlots(count: number, startAt: Date, intervalHours: number, maxPerDay: number): Date[] {
  const interval = Math.max(MIN_GAP_HOURS, intervalHours) * 3600_000;
  const perDay = Math.max(1, Math.min(MAX_POSTS_PER_DAY, maxPerDay));
  const slots: Date[] = [];
  let cursor = startAt.getTime();
  let dayStart = startAt.getTime();
  let inDay = 0;
  while (slots.length < count) {
    if (inDay >= perDay) {
      dayStart += DAY;
      cursor = dayStart;
      inDay = 0;
    }
    slots.push(new Date(cursor));
    inDay++;
    cursor += interval;
  }
  return slots;
}

/**
 * Regras por canal (trava eleitoral). O canal vem da conta conectada (SocialAccount.channel)
 * ou, sem isso, do usuário (User.channel) — no estúdio é 1 usuário do Cortix por canal.
 * Dentro de uma janela de bloqueio o canal não publica nem agenda; `boost: false` quer dizer
 * que nada no Cortix pode acionar impulsionamento pago pra esse canal.
 * Horários em America/Sao_Paulo (sem horário de verão desde 2019, então -03:00 fixo).
 */
export type ChannelRule = { aliases?: string[]; boost: boolean; blackouts: Array<{ inicio: string; fim: string; motivo: string }> };

export const CHANNEL_RULES: Record<string, ChannelRule> = {
  politica: {
    aliases: ["missao-resumo"],
    boost: false,
    blackouts: [
      { inicio: "2026-10-03T00:00:00-03:00", fim: "2026-10-04T20:00:00-03:00", motivo: "eleição, 1º turno" },
      { inicio: "2026-10-24T00:00:00-03:00", fim: "2026-10-25T20:00:00-03:00", motivo: "eleição, 2º turno" },
    ],
  },
};

function norm(c: string | null | undefined) {
  return (c ?? "").trim().toLowerCase();
}

/** Nome canônico do canal (resolve apelidos). A conta manda; sem canal na conta, vale o do usuário. */
export function resolveChannel(accountChannel?: string | null, userChannel?: string | null): string | null {
  const c = norm(accountChannel) || norm(userChannel);
  if (!c) return null;
  for (const [name, rule] of Object.entries(CHANNEL_RULES)) {
    if (name === c || rule.aliases?.includes(c)) return name;
  }
  return c;
}

/** Janela de bloqueio que contém `when` para o canal, ou null. */
export function channelBlackout(channel: string | null, when: Date) {
  const rule = channel ? CHANNEL_RULES[resolveChannel(channel)!] : undefined;
  if (!rule) return null;
  const t = when.getTime();
  return rule.blackouts.find((b) => t >= Date.parse(b.inicio) && t < Date.parse(b.fim)) ?? null;
}

/** Erro se algum horário cai numa janela de bloqueio do canal; null se está liberado. */
export function validateChannelSchedule(channel: string | null, dates: Date[]): string | null {
  for (const d of dates) {
    const b = channelBlackout(channel, d);
    if (b) return `Trava eleitoral: o canal "${resolveChannel(channel)}" não publica nem agenda entre ${fmtSp(b.inicio)} e ${fmtSp(b.fim)} (${b.motivo}). Escolha um horário a partir de ${fmtSp(b.fim)}.`;
  }
  return null;
}

/** Impulsionamento pago é permitido pra esse canal? Canal com regra e boost:false → nunca. */
export function canBoost(channel: string | null): boolean {
  const rule = channel ? CHANNEL_RULES[resolveChannel(channel)!] : undefined;
  return rule ? rule.boost : true;
}

function fmtSp(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
