import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ffmpegBin, run, storageDir } from "./bin";
import { PAN_SEC, type ReframeData, type ReframeKey } from "./reframe-curve";

/**
 * Reenquadramento automático 16:9 → 9:16 que segue o rosto (inspirado no modo TRACK do OpenShorts).
 *
 * Uma passada do ffmpeg entrega (a) as trocas de cena e (b) 3 frames/s em 320x240 pro detector
 * de rostos UltraFace (ONNX, ~1 MB, MIT). Por plano escolhe o rosto principal e monta uma "câmera":
 * corte seco na troca de cena, pan curto quando a pessoa se desloca, centro quando não há rosto.
 * Tempos das chaves são absolutos (segundos do vídeo original), pra sobreviver a ajustes de início/fim.
 */

export { reframeCenterExpr, reframeXAt, trackedCrop, TRACKED_LAYOUTS, type ReframeData, type ReframeKey } from "./reframe-curve";

const MODEL_URL = "https://github.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB/raw/master/models/onnx/version-RFB-320.onnx";
const FW = 320;
const FH = 240;
const FPS = 3;
const SCENE_THRESHOLD = 0.3;

interface Face {
  cx: number;
  w: number;
  s: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let session: Promise<{ ort: any; sess: any }> | null = null;

async function loadDetector() {
  if (!session) {
    session = (async () => {
      const file = path.join(storageDir("models"), "ultraface-rfb-320.onnx");
      if (!fs.existsSync(file) || fs.statSync(file).size < 1_000_000) {
        const res = await fetch(MODEL_URL, { redirect: "follow" });
        if (!res.ok) throw new Error(`download do detector de rosto falhou (HTTP ${res.status})`);
        fs.writeFileSync(file + ".part", Buffer.from(await res.arrayBuffer()));
        fs.renameSync(file + ".part", file);
      }
      const ort = await import("onnxruntime-node");
      const sess = await ort.InferenceSession.create(file, { logSeverityLevel: 3 });
      return { ort, sess };
    })().catch((e) => {
      session = null;
      throw e;
    });
  }
  return session;
}

function iou(a: number[], b: number[]) {
  const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const i = ix * iy;
  return i / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i);
}

async function detect(frame: Buffer): Promise<Face[]> {
  const { ort, sess } = await loadDetector();
  const n = FW * FH;
  const data = new Float32Array(3 * n);
  for (let p = 0; p < n; p++) {
    data[p] = (frame[p * 3] - 127) / 128;
    data[n + p] = (frame[p * 3 + 1] - 127) / 128;
    data[2 * n + p] = (frame[p * 3 + 2] - 127) / 128;
  }
  const out = await sess.run({ [sess.inputNames[0]]: new ort.Tensor("float32", data, [1, 3, FH, FW]) });
  const sc = out[sess.outputNames[0]].data as Float32Array;
  const bx = out[sess.outputNames[1]].data as Float32Array;
  const cand: Array<{ s: number; b: number[] }> = [];
  for (let k = 0; k < sc.length / 2; k++) {
    const s = sc[k * 2 + 1];
    if (s < 0.8) continue;
    const b = [bx[k * 4], bx[k * 4 + 1], bx[k * 4 + 2], bx[k * 4 + 3]];
    if (b[2] - b[0] < 0.02) continue; // rosto minúsculo (plateia, fundo)
    cand.push({ s, b });
  }
  cand.sort((a, b) => b.s - a.s);
  const keep: typeof cand = [];
  for (const c of cand) if (keep.every((k) => iou(k.b, c.b) < 0.3)) keep.push(c);
  return keep.slice(0, 6).map((c) => ({ cx: (c.b[0] + c.b[2]) / 2, w: c.b[2] - c.b[0], s: c.s }));
}

/** Uma passada: frames pro detector (stdout) + trocas de cena (showinfo no stderr). */
async function scan(src: string, start: number, dur: number) {
  const graph = `[0:v]split=2[a][b];[a]fps=${FPS},scale=${FW}:${FH}[fr];[b]scale=192:-2,select='gt(scene\\,${SCENE_THRESHOLD})',showinfo[sc]`;
  const args = ["-v", "info", "-hide_banner", "-ss", start.toFixed(3), "-t", dur.toFixed(3), "-i", src, "-filter_complex", graph, "-map", "[fr]", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1", "-map", "[sc]", "-f", "null", "-"];
  const frameSize = FW * FH * 3;
  const frames: Buffer[] = [];
  const cuts: number[] = [];
  await new Promise<void>((resolve, reject) => {
    const p = spawn(ffmpegBin(), args, { windowsHide: true });
    let buf: Buffer = Buffer.alloc(0);
    let errTail = "";
    let line = "";
    p.stdout.on("data", (c: Buffer) => {
      buf = buf.length ? Buffer.concat([buf, c]) : c;
      while (buf.length >= frameSize) {
        frames.push(Buffer.from(buf.subarray(0, frameSize)));
        buf = buf.subarray(frameSize);
      }
    });
    p.stderr.on("data", (d: Buffer) => {
      const s = line + d.toString();
      const lines = s.split(/\r?\n/);
      line = lines.pop() || "";
      for (const l of lines) {
        const m = l.match(/Parsed_showinfo.*pts_time:\s*([\d.]+)/);
        if (m) cuts.push(start + Number(m[1]));
        else errTail = (errTail + l + "\n").slice(-600);
      }
    });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error("ffmpeg (reframe) falhou: " + errTail))));
  });
  return { frames, cuts };
}

function median(v: number[]) {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0.5;
}

/** Analisa [start, end] do vídeo e devolve as chaves da câmera virtual. */
export async function analyzeReframe(src: string, start: number, end: number): Promise<ReframeData> {
  const dur = Math.max(0.5, end - start);
  const { frames, cuts } = await scan(src, start, dur);
  const samples: Array<{ t: number; faces: Face[] }> = [];
  for (let i = 0; i < frames.length; i++) samples.push({ t: start + i / FPS, faces: await detect(frames[i]) });

  // planos = trechos entre trocas de cena (ignora cortes a menos de 0,4s um do outro)
  const bounds = [start];
  for (const c of cuts.sort((a, b) => a - b)) if (c - bounds[bounds.length - 1] > 0.4 && end - c > 0.4) bounds.push(c);
  bounds.push(end);

  const keys: ReframeKey[] = [];
  let withFaces = 0;
  for (let b = 0; b < bounds.length - 1; b++) {
    const s0 = bounds[b];
    const s1 = bounds[b + 1];
    const shot = samples.filter((x) => x.t >= s0 - 0.01 && x.t < s1);
    // rosto principal do plano: o grupo (por posição) com mais "presença" = área × confiança somadas
    const groups: Array<{ cx: number; weight: number }> = [];
    for (const smp of shot)
      for (const f of smp.faces) {
        const g = groups.find((x) => Math.abs(x.cx - f.cx) < 0.08);
        const w = f.w * f.w * f.s;
        if (g) {
          g.cx = (g.cx * g.weight + f.cx * w) / (g.weight + w);
          g.weight += w;
        } else groups.push({ cx: f.cx, weight: w });
      }
    groups.sort((a, b) => b.weight - a.weight);
    const main = groups[0];
    if (!main) {
      keys.push({ t: s0, x: 0.5, cut: true });
      continue;
    }
    // trajetória do rosto principal dentro do plano (segue o mais próximo da posição anterior)
    let cur = main.cx;
    const track: Array<{ t: number; x: number }> = [];
    for (const smp of shot) {
      const near = smp.faces.filter((f) => Math.abs(f.cx - cur) < 0.12).sort((a, b) => Math.abs(a.cx - cur) - Math.abs(b.cx - cur))[0];
      if (near) {
        cur = near.cx;
        withFaces++;
      }
      track.push({ t: smp.t, x: cur });
    }
    const first = median(track.slice(0, FPS).map((p) => p.x));
    keys.push({ t: s0, x: first, cut: true });
    // pan quando a mediana móvel (1s) se afasta mais de 8% do enquadramento atual
    let held = first;
    for (let i = FPS; i < track.length; i++) {
      const m = median(track.slice(Math.max(0, i - FPS + 1), i + 1).map((p) => p.x));
      if (Math.abs(m - held) > 0.08 && track[i].t - keys[keys.length - 1].t > PAN_SEC + 0.4) {
        keys.push({ t: track[i].t - (FPS - 1) / FPS / 2, x: m, cut: false });
        held = m;
      }
    }
  }
  // junta chaves vizinhas praticamente iguais
  const merged: ReframeKey[] = [];
  for (const k of keys) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(last.x - k.x) < 0.025) continue;
    merged.push({ t: Number(k.t.toFixed(3)), x: Number(k.x.toFixed(4)), cut: k.cut });
  }
  if (!merged.length) merged.push({ t: start, x: 0.5, cut: true });
  return { v: 1, start, end, keys: merged, faces: withFaces };
}

/** Trocas de cena (segundos absolutos) num trecho curto, em baixa resolução. */
export async function detectSceneCuts(src: string, start: number, end: number): Promise<number[]> {
  const s = Math.max(0, start);
  const args = ["-v", "info", "-hide_banner", "-ss", s.toFixed(3), "-t", Math.max(0.2, end - s).toFixed(3), "-i", src, "-an", "-vf", `scale=192:-2,select='gt(scene\,${SCENE_THRESHOLD})',showinfo`, "-f", "null", "-"];
  const r = await run(ffmpegBin(), args);
  if (r.code !== 0) return [];
  return [...r.stderr.matchAll(/Parsed_showinfo.*pts_time:\s*([\d.]+)/g)].map((m) => s + Number(m[1]));
}

/**
 * Encaixa início/fim do corte nas trocas de cena próximas pra não abrir/fechar com um "flash" do plano
 * vizinho. Nunca corta palavra: o início só vai até antes da 1ª palavra e o fim só depois da última.
 */
export async function snapToScenes(src: string, clip: { start: number; end: number }, words: Array<{ start: number; end: number }>, limits: { min: number; max: number }) {
  const inside = words.filter((w) => w.start >= clip.start - 0.05 && w.end <= clip.end + 0.05);
  const firstWord = inside[0]?.start ?? clip.start;
  const lastWord = inside[inside.length - 1]?.end ?? clip.end;
  const [head, tail] = await Promise.all([detectSceneCuts(src, clip.start - 1.2, clip.start + 0.6), detectSceneCuts(src, clip.end - 0.6, clip.end + 1.0)]);
  let start = clip.start;
  let end = clip.end;
  // início: troca logo depois (antes de alguém falar) → começa nela; senão, troca pouco antes → recua até ela
  const after = head.filter((c) => c > start && c <= Math.min(start + 0.6, firstWord - 0.05));
  // só recua/estica por cima de silêncio: puxar o fim da frase anterior estraga o gancho
  const silent = (a: number, b: number) => !words.some((w) => w.end > a + 0.02 && w.start < b - 0.02);
  const before = head.filter((c) => c < start && c >= start - 1.2 && silent(c, start));
  if (after.length) start = after[after.length - 1];
  else if (before.length) start = before[before.length - 1];
  // fim: troca pouco antes (depois da última palavra) → termina nela; senão, troca logo depois → estica até ela
  const early = tail.filter((c) => c < end && c >= Math.max(end - 0.6, lastWord + 0.05));
  const late = tail.filter((c) => c > end && c <= end + 1.0 && silent(end, c));
  if (early.length) end = early[0];
  else if (late.length) end = late[0];
  // cortes de cena bem no frame: recua 1 frame (30 fps) pra não pegar o 1º quadro do próximo plano
  if (end !== clip.end) end -= 1 / 30;
  const dur = end - start;
  if (dur < limits.min || dur > limits.max) return clip;
  return { start: Number(start.toFixed(3)), end: Number(end.toFixed(3)) };
}
