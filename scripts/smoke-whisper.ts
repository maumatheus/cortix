/**
 * Smoke test da transcrição local (whisper.cpp). Baixa binário/modelo na 1ª vez.
 * Uso: npx tsx scripts/smoke-whisper.ts <video> [inicio] [fim]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { transcribeWithWhisper } from "../src/lib/video/whisper";

async function main() {
  const [src, a = "0", b = "60"] = process.argv.slice(2);
  if (!src || !fs.existsSync(src)) throw new Error("uso: npx tsx scripts/smoke-whisper.ts <video> [inicio] [fim]");
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "cortix-whisper-"));
  const t0 = Date.now();
  let last = "";
  const words = await transcribeWithWhisper(src, {
    start: Number(a),
    end: Number(b),
    language: "pt",
    workDir: work,
    onProgress: (stage, pct) => {
      const k = `${stage} ${Math.floor(pct / 25) * 25}%`;
      if (k !== last) console.log((last = k));
    },
  });
  const secs = (Date.now() - t0) / 1000;
  console.log(`${words.length} palavras em ${secs.toFixed(1)}s`);
  console.log(words.slice(0, 12).map((w) => `${w.start.toFixed(2)}-${w.end.toFixed(2)} ${w.text}`).join("\n"));
  if (!words.length) throw new Error("nenhuma palavra");
  if (words[0].start < Number(a) - 0.5) throw new Error("offset errado");
  fs.rmSync(work, { recursive: true, force: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
