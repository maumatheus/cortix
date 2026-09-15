import { renderClip, probe } from "../src/lib/video/render";
import { resolveEffects } from "../src/lib/effects";
import { getCaptionStyle } from "../src/lib/caption-styles";
import { ffmpegBin, run, storageDir } from "../src/lib/video/bin";
import path from "node:path";

// Uso: npx tsx scripts/smoke-effects.ts — gera um vídeo sintético (60 fps, como YouTube) e renderiza cada preset,
// conferindo que a duração do vídeo bate com a do áudio (regressão do zoompan com fonte 60 fps).

async function main() {
  const dir = storageDir("smoke");
  const src = path.join(dir, "src.mp4");
  const gen = await run(ffmpegBin(), ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=60:duration=8", "-f", "lavfi", "-i", "sine=frequency=440:duration=8", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest", src]);
  if (gen.code !== 0) throw new Error("não gerou vídeo de teste: " + gen.stderr.slice(0, 200));
  const groups = [
    { start: 0.5, end: 2.5, words: [{ text: "isso", start: 0.5, end: 1 }, { text: "aqui", start: 1, end: 1.5 }, { text: "é", start: 1.5, end: 1.8 }, { text: "teste", start: 1.8, end: 2.5 }] },
    { start: 3, end: 5.5, words: [{ text: "zoom", start: 3, end: 3.6 }, { text: "e", start: 3.6, end: 3.8 }, { text: "efeitos", start: 3.8, end: 4.6 }, { text: "novos", start: 4.6, end: 5.5 }] },
  ];
  for (const preset of ["monetize", "stealth", "viral"]) {
    const effects = resolveEffects({ preset, handle: "@cortixoficial" });
    const out = path.join(dir, `${preset}.mp4`);
    const t0 = Date.now();
    await renderClip({ src, start: 0.5, end: 7.5, layout: "center", style: getCaptionStyle("green-fresh"), groups, out, width: 540, crf: 28, preset: "veryfast", watermark: false, hook: "Gancho de teste", effects, primaryColor: "#7c3aed" });
    const info = await probe(out);
    if (Math.abs(info.duration - 7 / effects.speed) > 0.3) throw new Error(`${preset}: duracao ${info.duration.toFixed(2)}s, esperado ${(7 / effects.speed).toFixed(2)}s (video dessincronizado do audio)`);
    console.log(preset, "ok", `${Date.now() - t0}ms`, `${info.width}x${info.height}`, `dur=${info.duration.toFixed(2)}`, `audio=${info.hasAudio}`);
  }
}
main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
