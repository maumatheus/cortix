import Anthropic from "@anthropic-ai/sdk";
import { toSentences, type Word, type Sentence } from "./transcript";

export interface Highlight {
  start: number;
  end: number;
  title: string;
  reason: string;
  hook: string | null;
  score: number;
}

export interface SelectOptions {
  words: Word[];
  windowStart: number;
  windowEnd: number;
  count: number;
  minDur: number;
  maxDur: number;
  language?: string | null;
  videoTitle?: string;
}

const HOT_WORDS = [
  "nunca", "segredo", "erro", "verdade", "dinheiro", "milhão", "milhões", "grátis", "melhor", "pior", "impossível", "louco", "absurdo", "chocante",
  "never", "secret", "mistake", "truth", "money", "million", "free", "best", "worst", "impossible", "crazy", "insane", "shocking", "hack", "trick",
  "por que", "porque", "como", "why", "how", "what", "você", "you", "todo mundo", "everyone", "ninguém", "nobody", "sempre", "always",
];

function heuristicScore(text: string, dur: number, wordCount: number) {
  const lower = text.toLowerCase();
  let s = 5.5;
  for (const h of HOT_WORDS) if (lower.includes(h)) s += 0.18;
  if (/\?/.test(text)) s += 0.5;
  if (/!/.test(text)) s += 0.3;
  if (/\d/.test(text)) s += 0.3;
  const rate = wordCount / Math.max(1, dur); // palavras por segundo
  if (rate > 2.2) s += 0.5;
  else if (rate < 1.2) s -= 0.6;
  return Math.max(4, Math.min(9.6, s));
}

function snapToWords(words: Word[], start: number, end: number) {
  const first = words.find((w) => w.start >= start - 0.3);
  const lastIdx = (() => {
    let idx = -1;
    for (let i = 0; i < words.length; i++) if (words[i].end <= end + 0.3) idx = i;
    return idx;
  })();
  const s = first ? Math.max(0, first.start - 0.25) : start;
  const e = lastIdx >= 0 ? words[lastIdx].end + 0.35 : end;
  return { start: Number(s.toFixed(2)), end: Number(e.toFixed(2)) };
}

function heuristicSelect(o: SelectOptions): Highlight[] {
  const words = o.words.filter((w) => w.start >= o.windowStart && w.end <= o.windowEnd);
  const sentences = toSentences(words);
  const target = (o.minDur + o.maxDur) / 2;
  const cands: Highlight[] = [];
  for (let i = 0; i < sentences.length; i++) {
    let j = i;
    while (j < sentences.length && sentences[j].end - sentences[i].start < target) j++;
    if (j >= sentences.length) j = sentences.length - 1;
    const dur = sentences[j].end - sentences[i].start;
    if (dur < o.minDur * 0.8 || dur > o.maxDur * 1.15) continue;
    const slice = sentences.slice(i, j + 1);
    const text = slice.map((s) => s.text).join(" ");
    const wc = slice.reduce((a, b) => a + b.wordCount, 0);
    const rate = wc / Math.max(1, dur);
    cands.push({
      start: sentences[i].start,
      end: sentences[j].end,
      title: bestTitle(slice),
      reason: /\?/.test(text)
        ? "Abre com uma pergunta que gera curiosidade e mantém o público até a resposta, formato que costuma segurar retenção."
        : rate > 2.2
          ? "Ritmo de fala acelerado e ideia completa em poucos segundos, o tipo de trecho que prende a atenção no feed."
          : "Trecho com uma ideia fechada e frases de impacto, bom para virar corte com legenda dinâmica.",
      hook: null,
      score: Number(heuristicScore(text, dur, wc).toFixed(1)),
    });
  }
  cands.sort((a, b) => b.score - a.score);
  const picked: Highlight[] = [];
  for (const c of cands) {
    if (picked.some((p) => c.start < p.end && c.end > p.start)) continue;
    picked.push(c);
    if (picked.length >= o.count) break;
  }
  if (!picked.length && words.length) {
    // sem frases: janelas uniformes
    const span = o.windowEnd - o.windowStart;
    const n = Math.max(1, Math.min(o.count, Math.floor(span / target)));
    for (let k = 0; k < n; k++) {
      const s = o.windowStart + (span / n) * k + 2;
      picked.push({ start: s, end: Math.min(o.windowEnd, s + target), title: `Corte ${k + 1}`, reason: "Trecho selecionado automaticamente.", hook: null, score: 6 });
    }
  }
  return picked.map((p) => ({ ...p, ...snapToWords(words, p.start, p.end) })).sort((a, b) => b.score - a.score);
}

function makeTitle(sentence: string) {
  const clean = sentence.replace(/\s+/g, " ").replace(/\[[^\]]*\]/g, "").trim();
  const words = clean.split(" ").filter(Boolean);
  const cut = words.slice(0, 8).join(" ");
  const t = cut.replace(/[,.;:!?]+$/, "");
  if (!t) return "Corte";
  return t.charAt(0).toUpperCase() + t.slice(1) + (words.length > 8 ? "…" : "");
}

/** Escolhe a frase mais "gancho" de um trecho para virar título. */
function bestTitle(slice: Sentence[]) {
  let best = slice[0];
  let bestScore = -1;
  for (const s of slice) {
    const lower = s.text.toLowerCase();
    let sc = 0;
    if (/\?/.test(s.text)) sc += 2;
    if (/!/.test(s.text)) sc += 1;
    if (/\d/.test(s.text)) sc += 1;
    for (const h of HOT_WORDS) if (lower.includes(h)) sc += 1;
    if (s.wordCount >= 5 && s.wordCount <= 14) sc += 1.5;
    if (s.wordCount < 3) sc -= 2;
    if (sc > bestScore) {
      bestScore = sc;
      best = s;
    }
  }
  return makeTitle(best.text);
}

function compactTranscript(sentences: Sentence[]) {
  return sentences.map((s) => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text}`).join("\n");
}

async function aiSelect(o: SelectOptions, apiKey: string): Promise<Highlight[]> {
  const words = o.words.filter((w) => w.start >= o.windowStart && w.end <= o.windowEnd);
  const sentences = toSentences(words);
  if (!sentences.length) return [];
  let transcript = compactTranscript(sentences);
  if (transcript.length > 180_000) transcript = transcript.slice(0, 180_000);
  const client = new Anthropic({ apiKey });
  const lang = o.language?.startsWith("pt") ? "português do Brasil" : o.language?.startsWith("en") ? "inglês" : "o mesmo idioma da transcrição";
  const prompt = `Você é um editor de cortes virais para TikTok, Reels e Shorts.
Abaixo está a transcrição de um vídeo ("${o.videoTitle || "sem título"}") com marcações de tempo em segundos.
Escolha os ${o.count} melhores trechos para virar cortes verticais. Cada trecho deve:
- durar entre ${o.minDur} e ${o.maxDur} segundos;
- começar e terminar em fronteiras de frase (use os tempos das linhas);
- ter gancho forte nos primeiros 3 segundos, uma ideia completa e final satisfatório;
- não se sobrepor a outros trechos.
Responda SOMENTE com JSON válido no formato:
{"clips":[{"start":16.9,"end":62.5,"title":"...","reason":"...","hook":"...","score":9.4}]}
"title" curto e chamativo (até 8 palavras), "reason" com 1-2 frases explicando por que viraliza, "hook" uma frase de abertura sugerida para tela, "score" nota de viralidade de 1 a 10 com uma casa decimal. Escreva title, reason e hook em ${lang}.

TRANSCRIÇÃO:
${transcript}`;
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Resposta da IA sem JSON");
  const parsed = JSON.parse(m[0]) as { clips: Array<Partial<Highlight>> };
  const out: Highlight[] = [];
  for (const c of parsed.clips || []) {
    const start = Number(c.start);
    const end = Number(c.end);
    if (!isFinite(start) || !isFinite(end) || end - start < o.minDur * 0.6) continue;
    const snapped = snapToWords(words, start, Math.min(end, start + o.maxDur * 1.2));
    if (out.some((p) => snapped.start < p.end && snapped.end > p.start)) continue;
    out.push({
      ...snapped,
      title: String(c.title || makeTitle(sentences[0].text)).slice(0, 90),
      reason: String(c.reason || "").slice(0, 400),
      hook: c.hook ? String(c.hook).slice(0, 120) : null,
      score: Math.max(1, Math.min(10, Number(c.score) || 7)),
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, o.count);
}

export async function selectHighlights(o: SelectOptions): Promise<{ clips: Highlight[]; engine: "ai" | "heuristic" }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key && key.trim()) {
    try {
      const clips = await aiSelect(o, key.trim());
      if (clips.length) return { clips, engine: "ai" };
    } catch (e) {
      console.warn("[highlights] IA falhou, usando heurística:", (e as Error).message);
    }
  }
  return { clips: heuristicSelect(o), engine: "heuristic" };
}
