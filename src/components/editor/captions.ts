import { groupWords, wordsInRange, type CaptionGroup, type Word } from "@/lib/video/transcript";
import { CAPTION_STYLES, getCaptionStyle } from "@/lib/caption-styles";
import type { EditorStyle, ShortRecord } from "./types";
import { EMOJI_KEYWORDS } from "./constants";

/** Monta o estilo inicial do corte a partir do template do corte ou do projeto (mesma regra do servidor). */
export function initialStyle(short: ShortRecord): EditorStyle {
  const raw = (short.captionTemplate && Object.keys(short.captionTemplate).length ? short.captionTemplate : short.project.captionTemplate) || {};
  const base = getCaptionStyle((raw as { id?: string }).id);
  return { ...base, ...(raw as Partial<EditorStyle>) } as EditorStyle;
}

export function applyPreset(current: EditorStyle, presetId: string): EditorStyle {
  const preset = CAPTION_STYLES.find((s) => s.id === presetId) || CAPTION_STYLES[1];
  return { ...current, ...preset };
}

export function regroup(words: Word[], start: number, end: number, style: Pick<EditorStyle, "wordsPerGroup" | "maxChars">): CaptionGroup[] {
  return groupWords(wordsInRange(words, start, end), style.wordsPerGroup, style.maxChars);
}

function clone(g: CaptionGroup): CaptionGroup {
  return { start: g.start, end: g.end, words: g.words.map((w) => ({ ...w })) };
}

/**
 * Ajusta as legendas quando o intervalo do corte muda:
 * mantém os grupos editados que continuam dentro, apara os que ficaram parcialmente fora
 * e agrupa a transcrição nas partes novas.
 */
export function reconcileCaptions(groups: CaptionGroup[], words: Word[], oldRange: [number, number], newRange: [number, number], style: EditorStyle): CaptionGroup[] {
  const [ns, ne] = newRange;
  const kept: CaptionGroup[] = [];
  for (const g0 of groups) {
    if (g0.end <= ns || g0.start >= ne) continue;
    const g = clone(g0);
    g.start = Math.max(g.start, ns);
    g.end = Math.min(g.end, ne);
    g.words = g.words.filter((w) => w.end > ns && w.start < ne);
    if (g.end - g.start > 0.05) kept.push(g);
  }
  const added: CaptionGroup[] = [];
  if (ns < oldRange[0]) added.push(...regroup(words, ns, Math.min(oldRange[0], ne), style));
  if (ne > oldRange[1]) added.push(...regroup(words, Math.max(oldRange[1], ns), ne, style));
  const all = [...kept, ...added].sort((a, b) => a.start - b.start);
  // evita sobreposição entre grupo antigo e novo
  for (let i = 0; i < all.length - 1; i++) {
    if (all[i].end > all[i + 1].start) all[i].end = all[i + 1].start;
  }
  return all.filter((g) => g.end - g.start > 0.05);
}

/** Reescreve o texto de um grupo distribuindo as palavras uniformemente no tempo do grupo. */
export function setGroupText(g: CaptionGroup, text: string): CaptionGroup {
  const parts = text.split(/\s+/).filter(Boolean);
  const span = Math.max(0.1, g.end - g.start);
  return {
    ...g,
    words: parts.map((p, i) => ({ text: p, start: g.start + (span * i) / parts.length, end: g.start + (span * (i + 1)) / parts.length })),
  };
}

/** Move/redimensiona um grupo, reescalando os tempos das palavras. */
export function retimeGroup(g: CaptionGroup, start: number, end: number): CaptionGroup {
  const oldSpan = Math.max(0.01, g.end - g.start);
  const newSpan = Math.max(0.01, end - start);
  const k = newSpan / oldSpan;
  return { start, end, words: g.words.map((w) => ({ text: w.text, start: start + (w.start - g.start) * k, end: start + (w.end - g.start) * k })) };
}

/** Divide o grupo que contém `t` em dois. Retorna null se não for possível. */
export function splitGroups(groups: CaptionGroup[], t: number): { groups: CaptionGroup[]; index: number } | null {
  const i = groups.findIndex((g) => t > g.start + 0.05 && t < g.end - 0.05);
  if (i < 0) return null;
  const g = groups[i];
  let left = g.words.filter((w) => (w.start + w.end) / 2 < t);
  let right = g.words.filter((w) => (w.start + w.end) / 2 >= t);
  if (g.words.length >= 2) {
    if (!left.length) {
      left = [right[0]];
      right = right.slice(1);
    } else if (!right.length) {
      right = [left[left.length - 1]];
      left = left.slice(0, -1);
    }
  }
  const a: CaptionGroup = { start: g.start, end: t, words: left.map((w) => ({ ...w, end: Math.min(w.end, t) })) };
  const b: CaptionGroup = { start: t, end: g.end, words: right.map((w) => ({ ...w, start: Math.max(w.start, t) })) };
  const out = [...groups.slice(0, i), a, b, ...groups.slice(i + 1)];
  return { groups: out, index: i + 1 };
}

/** Junta o grupo `i` com o seguinte. */
export function mergeGroups(groups: CaptionGroup[], i: number): CaptionGroup[] {
  if (i < 0 || i >= groups.length - 1) return groups;
  const a = groups[i];
  const b = groups[i + 1];
  const merged: CaptionGroup = { start: a.start, end: b.end, words: [...a.words, ...b.words] };
  return [...groups.slice(0, i), merged, ...groups.slice(i + 2)];
}

/** "Cola" as cenas: fecha os buracos entre grupos vizinhos. */
export function glueGroups(groups: CaptionGroup[]): CaptionGroup[] {
  const out = groups.map(clone);
  for (let i = 0; i < out.length - 1; i++) out[i].end = out[i + 1].start;
  return out;
}

export function groupText(g: CaptionGroup) {
  return g.words.map((w) => w.text).join(" ");
}

export function emojiFor(text: string): string | null {
  for (const [re, e] of EMOJI_KEYWORDS) if (re.test(text)) return e;
  return null;
}

/** Busca binária do grupo ativo em `t`. */
export function findGroupIndex(groups: CaptionGroup[], t: number): number {
  let lo = 0;
  let hi = groups.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const g = groups[mid];
    if (t < g.start) hi = mid - 1;
    else if (t >= g.end) lo = mid + 1;
    else return mid;
  }
  return -1;
}

export function fmtClip(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec - Math.floor(sec)) * 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export function fmtRuler(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? "0" : ""}${Number.isInteger(s) ? s : s.toFixed(1)}`;
}
