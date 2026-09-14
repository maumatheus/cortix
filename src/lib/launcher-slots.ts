/** Utilidades de horário dos launchers ("09:00", "18:00"...). */

export function parseTimes(raw: string): string[] {
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((t): t is string => typeof t === "string" && /^\d{2}:\d{2}$/.test(t)).sort();
  } catch {
    return [];
  }
}

export function parsePlatforms(raw: string): string[] {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

/** Próximo horário (estritamente depois de `after`) que bate com um dos horários configurados. */
export function nextSlot(times: string[], after: Date): Date | null {
  const list = times.length ? [...times].sort() : ["09:00"];
  const base = new Date(after);
  for (let day = 0; day < 400; day++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + day);
    for (const t of list) {
      const [h, m] = t.split(":").map(Number);
      const cand = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
      if (cand.getTime() > after.getTime()) return cand;
    }
  }
  return null;
}
