/**
 * Corte completo como o app faz: whisper (legenda palavra a palavra) + troca de cena + câmera em quem fala
 * + legenda ASS + efeitos. Útil pra conferir no olho o resultado final de um trecho.
 * Uso: npx tsx scripts/smoke-full.ts <video> <inicio> <fim> <saida.mp4> [estilo] [preset]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { transcribeWithWhisper } from "../src/lib/video/whisper";
import { analyzeReframe, snapToScenes } from "../src/lib/video/reframe";
import { groupWords, wordsInRange } from "../src/lib/video/transcript";
import { renderClip } from "../src/lib/video/render";
import { getCaptionStyle } from "../src/lib/caption-styles";
import { resolveEffects } from "../src/lib/effects";

async function main() {
  const [src, a, b, out, styleId = "green-fresh", preset = "viral"] = process.argv.slice(2);
  if (!src || !out) throw new Error("uso: npx tsx scripts/smoke-full.ts <video> <inicio> <fim> <saida.mp4> [estilo] [preset]");
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "cortix-full-"));
  const t0 = Date.now();
  const lap = (s: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s  ${s}`);

  const words = await transcribeWithWhisper(src, { start: Math.max(0, Number(a) - 2), end: Number(b) + 2, language: "pt", workDir: work });
  lap(`transcrição: ${words.length} palavras`);
  const clip = await snapToScenes(src, { start: Number(a), end: Number(b) }, words, { min: 0, max: 999 });
  lap(`trecho ajustado às cenas: ${clip.start.toFixed(2)} → ${clip.end.toFixed(2)}`);
  const reframe = await analyzeReframe(src, clip.start, clip.end);
  lap(`câmera: ${reframe.keys.length} chaves`);

  const style = getCaptionStyle(styleId);
  const groups = groupWords(wordsInRange(words, clip.start, clip.end), style.wordsPerGroup, style.maxChars);
  await renderClip({
    src,
    start: clip.start,
    end: clip.end,
    layout: "single",
    style,
    groups,
    out: path.resolve(out),
    width: 1080,
    crf: 21,
    preset: "faster",
    captionsEnabled: true,
    effects: resolveEffects(JSON.stringify({ preset })),
    primaryColor: style.highlightColor,
    reframe: reframe.faces ? reframe : null,
  });
  lap(`render: ${out}`);
  fs.rmSync(work, { recursive: true, force: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
