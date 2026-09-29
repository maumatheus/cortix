/**
 * Smoke test do reenquadramento que segue o rosto: analisa um trecho, mostra as chaves da câmera,
 * renderiza em 540p e gera uma folha de contato (1 frame/s) pra conferir no olho.
 * Uso: npx tsx scripts/smoke-reframe.ts <video> [inicio] [fim]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzeReframe, reframeCenterExpr, trackedCrop } from "../src/lib/video/reframe";
import { ffmpegBin, run } from "../src/lib/video/bin";

async function main() {
  const [src, a = "0", b = "30"] = process.argv.slice(2);
  if (!src || !fs.existsSync(src)) throw new Error("uso: npx tsx scripts/smoke-reframe.ts <video> [inicio] [fim]");
  const start = Number(a);
  const end = Number(b);
  const t0 = Date.now();
  const data = await analyzeReframe(src, start, end);
  console.log(`análise: ${((Date.now() - t0) / 1000).toFixed(1)}s · ${data.keys.length} chaves · ${data.faces} frames com rosto`);
  for (const k of data.keys) console.log(`  ${k.t.toFixed(2)}s  x=${k.x.toFixed(3)}  ${k.cut ? "corte" : "pan"}`);
  console.log("expr:", reframeCenterExpr(data, start).length, "caracteres");

  const out = path.join(os.tmpdir(), "cortix-reframe.mp4");
  const sheet = path.join(os.tmpdir(), "cortix-reframe-sheet.jpg");
  const vf = `${trackedCrop(data, start)},scale=540:960`;
  let r = await run(ffmpegBin(), ["-y", "-v", "error", "-ss", String(start), "-t", String(end - start), "-i", src, "-vf", vf, "-an", "-c:v", "libx264", "-preset", "veryfast", out]);
  if (r.code !== 0) throw new Error(r.stderr);
  const cols = Math.min(10, Math.ceil(end - start));
  r = await run(ffmpegBin(), ["-y", "-v", "error", "-i", out, "-vf", `fps=1,scale=135:240,tile=${cols}x${Math.ceil((end - start) / cols)}`, "-frames:v", "1", sheet]);
  if (r.code !== 0) throw new Error(r.stderr);
  console.log("render:", out, "\nfolha:", sheet);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
