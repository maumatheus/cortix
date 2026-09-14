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
