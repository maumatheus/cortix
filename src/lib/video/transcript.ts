export interface Word {
  text: string;
  start: number; // segundos
  end: number;
}

export interface CaptionGroup {
  start: number;
  end: number;
  words: Word[];
}

/** Converte o formato json3 do YouTube (já parseado) em palavras com tempo. */
export function wordsFromJson3(raw: { events?: unknown[] }): Word[] {
  const events = (raw.events || []) as Array<{ tStartMs: number; dDurationMs?: number; segs?: Array<{ utf8: string; tOffsetMs?: number }>; aAppend?: number }>;
  const words: Word[] = [];
  for (const ev of events) {
    if (!ev.segs || ev.aAppend) continue;
    const evStart = ev.tStartMs / 1000;
    const evEnd = evStart + (ev.dDurationMs || 0) / 1000;
    const segs = ev.segs.filter((s) => s.utf8 && s.utf8.trim() && s.utf8 !== "\n");
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const start = evStart + (s.tOffsetMs || 0) / 1000;
      const nextStart = i + 1 < segs.length ? evStart + (segs[i + 1].tOffsetMs || 0) / 1000 : evEnd;
      const text = s.utf8.replace(/\s+/g, " ").trim();
      if (!text) continue;
      // legendas automáticas podem trazer várias palavras num seg
      const parts = text.split(" ").filter(Boolean);
      const span = Math.max(0.05, nextStart - start);
      parts.forEach((p, k) => {
        const ws = start + (span * k) / parts.length;
        const we = start + (span * (k + 1)) / parts.length;
        words.push({ text: p, start: ws, end: we });
      });
    }
  }
  // remove duplicatas (legenda rolante repete linhas)
  const out: Word[] = [];
  for (const w of words) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.start - w.start) < 0.01 && last.text === w.text) continue;
    if (last && w.start < last.start) continue;
    out.push(w);
  }
  // garante end <= próximo start
  for (let i = 0; i < out.length - 1; i++) {
    if (out[i].end > out[i + 1].start) out[i].end = out[i + 1].start;
    if (out[i].end - out[i].start > 2.5) out[i].end = out[i].start + 2.5;
  }
  return out;
}

export interface Sentence {
  text: string;
  start: number;
  end: number;
  wordCount: number;
}

/** Agrupa palavras em frases usando pontuação e pausas. */
export function toSentences(words: Word[], maxGap = 0.9, maxWords = 28): Sentence[] {
  const out: Sentence[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    out.push({ text: cur.map((w) => w.text).join(" "), start: cur[0].start, end: cur[cur.length - 1].end, wordCount: cur.length });
    cur = [];
  };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = words[i - 1];
    if (prev && w.start - prev.end > maxGap) flush();
    cur.push(w);
    if (/[.!?…]$/.test(w.text) || cur.length >= maxWords) flush();
  }
  flush();
  return out;
}

/** Agrupa palavras em blocos de legenda. */
export function groupWords(words: Word[], wordsPerGroup = 4, maxChars = 26, maxGap = 1.0): CaptionGroup[] {
  const groups: CaptionGroup[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    groups.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur });
    cur = [];
  };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = words[i - 1];
    if (prev && w.start - prev.end > maxGap) flush();
    const chars = cur.reduce((a, b) => a + b.text.length + 1, 0) + w.text.length;
    if (cur.length >= wordsPerGroup || chars > maxChars) flush();
    cur.push(w);
    if (/[.!?]$/.test(w.text) && cur.length >= 2) flush();
  }
  flush();
  // fecha buracos pequenos entre grupos para a legenda não piscar
  for (let i = 0; i < groups.length - 1; i++) {
    const gap = groups[i + 1].start - groups[i].end;
    if (gap > 0 && gap < 0.6) groups[i].end = groups[i + 1].start;
    if (groups[i].end - groups[i].start < 0.4) groups[i].end = Math.min(groups[i].start + 0.4, groups[i + 1].start);
  }
  return groups;
}

export function wordsInRange(words: Word[], start: number, end: number): Word[] {
  return words.filter((w) => w.start >= start - 0.05 && w.end <= end + 0.05);
}

export function transcriptText(words: Word[], start: number, end: number) {
  return wordsInRange(words, start, end)
    .map((w) => w.text)
    .join(" ");
}
