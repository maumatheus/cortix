// Diagnóstico de quem fala: abertura da boca (MediaPipe Face Mesh V2) por rosto, em janelas de 2s.
// Uso: node scripts/probe-speaker.mjs <video> <inicio> <fim> [mesh.onnx]
import ort from "onnxruntime-node";
import { spawn } from "node:child_process";
import path from "node:path";

const [src, a, b, meshPath] = process.argv.slice(2);
const start = +a, dur = +b - +a;
const FPS = 10, DW = 320, DH = 240, M = 256;
const det = await ort.InferenceSession.create(path.resolve("storage/models/ultraface-rfb-320.onnx"), { logSeverityLevel: 3 });
const mesh = await ort.InferenceSession.create(path.resolve(meshPath || "storage/models/face-mesh-v2.onnx"), { logSeverityLevel: 3 });

// resolução nativa (rostos pequenos precisam de pixels)
const probe = spawn("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", src]);
let pOut = ""; for await (const c of probe.stdout) pOut += c;
const [VW, VH] = pOut.trim().split(",").map(Number);

function sampleNN(rgb, W, H, x0, y0, x1, y1, OW, OH, out, norm) {
  for (let y = 0; y < OH; y++) {
    const sy = Math.min(H - 1, Math.max(0, Math.floor(y0 + ((y + 0.5) * (y1 - y0)) / OH)));
    for (let x = 0; x < OW; x++) {
      const sx = Math.min(W - 1, Math.max(0, Math.floor(x0 + ((x + 0.5) * (x1 - x0)) / OW)));
      const si = (sy * W + sx) * 3;
      norm(out, y * OW + x, rgb[si], rgb[si + 1], rgb[si + 2]);
    }
  }
}
async function detect(rgb) {
  const n = DW * DH, data = new Float32Array(3 * n);
  sampleNN(rgb, VW, VH, 0, 0, VW, VH, DW, DH, data, (o, p, r, g, b) => { o[p] = (r - 127) / 128; o[n + p] = (g - 127) / 128; o[2 * n + p] = (b - 127) / 128; });
  const out = await det.run({ input: new ort.Tensor("float32", data, [1, 3, DH, DW]) });
  const sc = out.scores.data, bx = out.boxes.data, c = [];
  for (let k = 0; k < sc.length / 2; k++) if (sc[k * 2 + 1] > 0.8) c.push({ s: sc[k * 2 + 1], b: [bx[k * 4], bx[k * 4 + 1], bx[k * 4 + 2], bx[k * 4 + 3]] });
  c.sort((p, q) => q.s - p.s);
  const keep = [];
  for (const f of c) if (keep.every((k) => iou(k.b, f.b) < 0.3)) keep.push(f);
  return keep.slice(0, 6).map((f) => f.b);
}
function iou(a, b) { const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])), iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1])), i = ix * iy; return i / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i); }

/** abertura da boca = distância lábio interno sup(13)/inf(14) ÷ largura da boca (78↔308) */
async function mouthOpen(rgb, [x1, y1, x2, y2]) {
  const cx = ((x1 + x2) / 2) * VW, cy = ((y1 + y2) / 2) * VH;
  const side = Math.max((x2 - x1) * VW, (y2 - y1) * VH) * 1.5;
  const data = new Float32Array(M * M * 3);
  sampleNN(rgb, VW, VH, cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2, M, M, data, (o, p, r, g, b) => { o[p * 3] = r / 255; o[p * 3 + 1] = g / 255; o[p * 3 + 2] = b / 255; });
  const out = await mesh.run({ [mesh.inputNames[0]]: new ort.Tensor("float32", data, [1, M, M, 3]) });
  const L = out[mesh.outputNames[0]].data, presence = out[mesh.outputNames[1]].data[0];
  const P = (i) => [L[i * 3], L[i * 3 + 1]];
  const d = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  return { open: d(P(13), P(14)) / Math.max(1, d(P(78), P(308))), presence, px: side };
}

const ff = spawn("ffmpeg", ["-v", "error", "-ss", String(start), "-t", String(dur), "-i", src, "-vf", `fps=${FPS}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
const fsz = VW * VH * 3; let buf = Buffer.alloc(0), fi = 0;
const tracks = [];
const t0 = Date.now();
for await (const ch of ff.stdout) {
  buf = Buffer.concat([buf, ch]);
  while (buf.length >= fsz) {
    const frame = buf.subarray(0, fsz);
    for (const box of await detect(frame)) {
      const cx = (box[0] + box[2]) / 2;
      let tr = tracks.find((t) => Math.abs(t.cx - cx) < 0.06);
      if (!tr) tracks.push((tr = { cx, open: [], idx: [], px: 0 }));
      const m = await mouthOpen(frame, box);
      tr.open.push(m.open); tr.idx.push(fi); tr.px = m.px;
    }
    buf = buf.subarray(fsz); fi++;
  }
}
console.log(`${fi} frames ${VW}x${VH} em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const avg = (v) => v.reduce((p, q) => p + q, 0) / (v.length || 1);
// "atividade" da boca = média da variação absoluta quadro a quadro
const act = (v) => (v.length < 3 ? 0 : avg(v.slice(1).map((x, i) => Math.abs(x - v[i]))));
const T = tracks.filter((t) => t.open.length > 5).sort((p, q) => p.cx - q.cx);
for (const t of T) console.log(`cx=${t.cx.toFixed(2)} rosto≈${Math.round(t.px / 1.5)}px abertura média=${avg(t.open).toFixed(3)} atividade=${act(t.open).toFixed(4)}`);
const W = FPS * 2;
console.log("\njanela   " + T.map((t) => `cx=${t.cx.toFixed(2)}`.padEnd(14)).join(""));
for (let w0 = 0; w0 < fi; w0 += W) {
  const row = T.map((t) => {
    const v = t.open.filter((_, k) => t.idx[k] >= w0 && t.idx[k] < w0 + W);
    return (v.length < W / 2 ? "-" : act(v).toFixed(4)).padEnd(14);
  });
  console.log(`${(start + w0 / FPS).toFixed(1)}s`.padEnd(9) + row.join(""));
}
