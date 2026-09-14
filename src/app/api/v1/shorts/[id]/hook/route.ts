import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { isSubscriber } from "@/lib/auth";
import { fail, ok, withUser } from "@/lib/api";
import { toSentences, wordsInRange, type Word } from "@/lib/video/transcript";

/** Hook heurístico: primeira frase do corte, até 8 palavras, sem pontuação final. */
function heuristicHook(text: string, title: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  const src = clean || title;
  const parts = src.split(" ").filter(Boolean).slice(0, 8);
  let out = parts.join(" ").replace(/[,.;:!?…]+$/, "");
  if (!out) out = title;
  out = out.charAt(0).toUpperCase() + out.slice(1);
  return out.length > 80 ? out.slice(0, 77).trimEnd() + "…" : out;
}

async function aiHook(apiKey: string, transcript: string, title: string): Promise<string | null> {
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    max_tokens: 200,
    system: "Você escreve hooks curtos para vídeos verticais (TikTok, Reels, Shorts) em português do Brasil. Responda apenas com o hook, sem aspas, sem explicações.",
    messages: [
      {
        role: "user",
        content: `Título do corte: ${title}\n\nTranscrição do corte:\n${transcript}\n\nEscreva um hook de no máximo 6 palavras, em português do Brasil, que prenda a atenção nos 3 primeiros segundos. Sem emojis, sem hashtags, sem pontuação final.`,
      },
    ],
  });
  if (res.stop_reason === "refusal") return null;
  const text = res.content
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("")
    .trim();
  const first = text.split("\n").map((l) => l.trim()).find(Boolean) || "";
  const hook = first.replace(/^["'“”«»]+|["'“”«»]+$/g, "").replace(/[.!?…]+$/, "").trim();
  return hook ? hook.slice(0, 80) : null;
}

export const POST = withUser(async ({ params, user }) => {
  if (!isSubscriber(user!)) return fail("Plano ativo necessário para gerar hooks com IA", 402);
  const short = await db.short.findFirst({ where: { id: params.id, project: { userId: user!.id } }, include: { project: true } });
  if (!short) return fail("Corte não encontrado", 404);

  const words: Word[] = short.project.transcript ? JSON.parse(short.project.transcript) : [];
  const inRange = wordsInRange(words, short.startTime, short.endTime);
  const sentences = toSentences(inRange);
  const transcript = sentences.map((s) => s.text).join(" ").slice(0, 6000);
  const fallback = heuristicHook(sentences[0]?.text || "", short.title);

  const key = process.env.ANTHROPIC_API_KEY;
  if (key && key.trim() && transcript) {
    try {
      const hook = await aiHook(key, transcript, short.title);
      if (hook) return ok({ hook, engine: "ai" });
    } catch (e) {
      console.error("[hook] IA falhou, usando heurística:", (e as Error).message);
    }
  }
  return ok({ hook: fallback, engine: "heuristic" });
});
