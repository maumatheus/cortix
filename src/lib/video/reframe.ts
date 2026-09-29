import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ffmpegBin, run, storageDir } from "./bin";
import { PAN_SEC, type ReframeData, type ReframeKey } from "./reframe-curve";
import { probe } from "./render";

/**
 * Reenquadramento automático 16:9 → 9:16 que segue o rosto (inspirado no modo TRACK do OpenShorts).
 *
 * Uma passada do ffmpeg entrega (a) as trocas de cena e (b) 3 frames/s em 320x240 pro detector
 * de rostos UltraFace (ONNX, ~1 MB, MIT). Por plano monta uma "câmera": corte seco na troca de cena,
 * pan curto quando a pessoa se desloca, centro quando não há rosto. Plano com várias pessoas que não
 * cabem juntas no 9:16: a câmera vai em quem está falando, medido pela abertura da boca (MediaPipe
 * Face Mesh V2, Apache-2.0) em resolução nativa — só nesses planos, porque custa ~1s por segundo de vídeo.
 * Tempos das chaves são absolutos (segundos do vídeo original), pra sobreviver a ajustes de início/fim.
 */

export { reframeCenterExpr, reframeXAt, trackedCrop, TRACKED_LAYOUTS, type ReframeData, type ReframeKey } from "./reframe-curve";

const MODEL_URL = "https://github.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB/raw/master/models/onnx/version-RFB-320.onnx";
const MESH_URL = "https://huggingface.co/fernandotonon/QtMeshEditor-facemesh-onnx/resolve/main/face_landmarks.onnx";
const FW = 320;
const FH = 240;
const FPS = 3;
const SCENE_THRESHOLD = 0.3;

// quem está falando (planos com várias pessoas)
const SPEAK_FPS = 8;
const SPEAK_MAX_W = 1280; // resolução usada pra ler a boca (rostos pequenos precisam de pixels)
const MESH = 256;
const MIN_HOLD = 2; // segundos mínimos em cada pessoa, pra câmera não ficar pulando

interface Face {
  cx: number;
  w: number;
  s: number;
  b: number[]; // caixa normalizada x1,y1,x2,y2
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Session = { ort: any; sess: any };
const sessions = new Map<string, Promise<Session>>();

function loadModel(name: string, url: string, minBytes: number) {
  let s = sessions.get(name);
  if (!s) {
    s = (async () => {
      const file = path.join(storageDir("models"), name);
      if (!fs.existsSync(file) || fs.statSync(file).size < minBytes) {
        const res = await fetch(url, { redirect: "follow" });
        if (!res.ok) throw new Error(`download do modelo ${name} falhou (HTTP ${res.status})`);
        fs.writeFileSync(file + ".part", Buffer.from(await res.arrayBuffer()));
        fs.renameSync(file + ".part", file);
      }
      const ort = await import("onnxruntime-node");
      const sess = await ort.InferenceSession.create(file, { logSeverityLevel: 3 });
      return { ort, sess };
    })();
    s.catch(() => sessions.delete(name));
    sessions.set(name, s);
  }
  return s;
}

const loadDetector = () => loadModel("ultraface-rfb-320.onnx", MODEL_URL, 1_000_000);
const loadMesh = () => loadModel("face-mesh-v2.onnx", MESH_URL, 4_000_000);

function iou(a: number[], b: number[]) {
  const ix = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0]));
  const iy = Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const i = ix * iy;
  return i / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i);
}

/** Recorta [x0,x1]x[y0,y1] (pixels) de um frame RGB e reamostra pra OWxOH (vizinho mais próximo). */
function sample(rgb: Buffer, W: number, H: number, box: [number, number, number, number], OW: number, OH: number, put: (p: number, r: number, g: number, b: number) => void) {
  const [x0, y0, x1, y1] = box;
  for (let y = 0; y < OH; y++) {
    const sy = Math.min(H - 1, Math.max(0, Math.floor(y0 + ((y + 0.5) * (y1 - y0)) / OH)));
    for (let x = 0; x < OW; x++) {
      const sx = Math.min(W - 1, Math.max(0, Math.floor(x0 + ((x + 0.5) * (x1 - x0)) / OW)));
      const si = (sy * W + sx) * 3;
      put(y * OW + x, rgb[si], rgb[si + 1], rgb[si + 2]);
    }
  }
}

async function detect(frame: Buffer, W = FW, H = FH): Promise<Face[]> {
  const { ort, sess } = await loadDetector();
  const n = FW * FH;
  const data = new Float32Array(3 * n);
  sample(frame, W, H, [0, 0, W, H], FW, FH, (p, r, g, b) => {
    data[p] = (r - 127) / 128;
    data[n + p] = (g - 127) / 128;
    data[2 * n + p] = (b - 127) / 128;
  });
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
  return keep.slice(0, 6).map((c) => ({ cx: (c.b[0] + c.b[2]) / 2, w: c.b[2] - c.b[0], s: c.s, b: c.b }));
}

/**
 * Abertura da boca (lábio interno 13↔14 ÷ largura da boca 78↔308) pelo Face Mesh, no rosto em resolução nativa.
 * Devolve null com o rosto de perfil (nariz fora do meio dos olhos): ali a leitura da boca vira ruído e a
 * própria virada de cabeça parecia "fala".
 */
async function mouthOpen(frame: Buffer, W: number, H: number, b: number[]) {
  const { ort, sess } = await loadMesh();
  const cx = ((b[0] + b[2]) / 2) * W;
  const cy = ((b[1] + b[3]) / 2) * H;
  const side = Math.max((b[2] - b[0]) * W, (b[3] - b[1]) * H) * 1.5;
  const data = new Float32Array(MESH * MESH * 3);
  sample(frame, W, H, [cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2], MESH, MESH, (p, r, g, bl) => {
    data[p * 3] = r / 255;
    data[p * 3 + 1] = g / 255;
    data[p * 3 + 2] = bl / 255;
  });
  const out = await sess.run({ [sess.inputNames[0]]: new ort.Tensor("float32", data, [1, MESH, MESH, 3]) });
  const L = out[sess.outputNames[0]].data as Float32Array;
  const d = (i: number, j: number) => Math.hypot(L[i * 3] - L[j * 3], L[i * 3 + 1] - L[j * 3 + 1]);
  const eyes = d(33, 263);
  const yaw = Math.abs(d(1, 33) - d(1, 263)) / Math.max(1, eyes);
  if (yaw > 0.35) return null;
  return d(13, 14) / Math.max(1, d(78, 308));
}

/**
 * Quem fala num plano com várias pessoas: lê a abertura da boca de cada candidato a SPEAK_FPS e devolve
 * os trechos [{t, x}] da câmera. Atividade = variação média da abertura numa janela de 2s; quem fala
 * abre e fecha a boca no ritmo das sílabas, quem escuta fica parado. Como o render é offline, a troca
 * acontece quando a pessoa começa a falar (sem atraso), mas cada pessoa fica pelo menos MIN_HOLD.
 */
async function speakerSegments(src: string, s0: number, s1: number, cands: number[], fallback: number, dims: { w: number; h: number }) {
  const W = Math.min(SPEAK_MAX_W, dims.w - (dims.w % 2));
  const H = Math.round((dims.h * W) / dims.w / 2) * 2;
  const args = ["-v", "error", "-ss", s0.toFixed(3), "-t", Math.max(0.3, s1 - s0).toFixed(3), "-i", src, "-an", "-vf", `fps=${SPEAK_FPS},scale=${W}:${H}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"];
  const series: Array<Array<{ t: number; v: number | null }>> = cands.map(() => []);
  const p = spawn(ffmpegBin(), args, { windowsHide: true });
  const size = W * H * 3;
  let buf: Buffer = Buffer.alloc(0);
  let fi = 0;
  for await (const chunk of p.stdout as AsyncIterable<Buffer>) {
    buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
    while (buf.length >= size) {
      const frame = buf.subarray(0, size);
      const t = s0 + fi / SPEAK_FPS;
      for (const f of await detect(frame, W, H)) {
        const ci = cands.findIndex((c) => Math.abs(c - f.cx) < 0.08);
        if (ci >= 0) series[ci].push({ t, v: await mouthOpen(frame, W, H, f.b) });
      }
      buf = buf.subarray(size);
      fi++;
    }
  }
  // atividade de cada candidato em t: média de |Δabertura| entre quadros consecutivos válidos em [t-1, t+1]
  const step = 1.5 / SPEAK_FPS;
  const activity = (ci: number, t: number) => {
    const v = series[ci].filter((x) => x.t >= t - 1 && x.t <= t + 1);
    let sum = 0;
    let n = 0;
    for (let i = 1; i < v.length; i++) {
      const a = v[i - 1].v;
      const b = v[i].v;
      if (a === null || b === null || v[i].t - v[i - 1].t > step) continue;
      sum += Math.abs(b - a);
      n++;
    }
    return n < SPEAK_FPS / 2 ? -1 : sum / n; // -1 = rosto sumiu ou de perfil nesse trecho
  };
  // vencedor claro a cada 0,5s: ≥ 0,02 e 1,6× o segundo colocado
  const grid: Array<{ t: number; who: number }> = [];
  for (let t = s0; t < s1; t += 0.5) {
    const acts = cands.map((_, ci) => activity(ci, t));
    const order = acts.map((a, ci) => [a, ci]).sort((a, b) => b[0] - a[0]);
    const [best, second] = [order[0], order[1]];
    if (process.env.CORTIX_SPEAKER_DEBUG) console.log(`[speaker] ${t.toFixed(1)}s ` + acts.map((a, ci) => `${cands[ci].toFixed(2)}:${a < 0 ? "-" : a.toFixed(3)}`).join(" "));
    grid.push({ t, who: best[0] >= 0.02 && (!second || best[0] >= 1.6 * Math.max(0.005, second[0])) ? best[1] : -1 });
  }
  // render é offline, então dá pra olhar pra frente: voto majoritário em ±1s tira os picos isolados
  const smooth = grid.map((g, i) => {
    const votes = new Map<number, number>();
    for (let k = Math.max(0, i - 2); k <= Math.min(grid.length - 1, i + 2); k++) if (grid[k].who >= 0) votes.set(grid[k].who, (votes.get(grid[k].who) ?? 0) + 1);
    const top = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    return { t: g.t, who: top && top[1] >= 2 ? top[0] : -1 };
  });
  // trechos por pessoa; indecisão mantém quem estava; o começo vai pra quem fala primeiro (ou o rosto principal)
  let cur = smooth.find((g) => g.who >= 0)?.who ?? cands.findIndex((c) => c === fallback);
  if (cur < 0) cur = 0;
  let segs: Array<{ t: number; who: number }> = [{ t: s0, who: cur }];
  for (const g of smooth) {
    if (g.who < 0 || g.who === cur) continue;
    segs.push({ t: g.t, who: g.who });
    cur = g.who;
  }
  // trecho curto demais (< MIN_HOLD) é absorvido pelo anterior; o último precisa de 1s até o fim do plano
  const bounds = (i: number) => (i + 1 < segs.length ? segs[i + 1].t : s1) - segs[i].t;
  for (let i = segs.length - 1; i >= 1; i--) if (bounds(i) < MIN_HOLD) segs.splice(i, 1);
  segs = segs.filter((sg, i) => i === 0 || sg.who !== segs[i - 1].who);
  return segs.map((sg) => ({ t: sg.t, x: cands[sg.who] }));
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
  const [{ frames, cuts }, info] = await Promise.all([scan(src, start, dur), probe(src)]);
  const cropW = info.width && info.height ? 9 / 16 / (info.width / info.height) : 0.32; // largura do 9:16 em fração do quadro
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
    const groups: Array<{ cx: number; weight: number; n: number; w: number }> = [];
    for (const smp of shot)
      for (const f of smp.faces) {
        const g = groups.find((x) => Math.abs(x.cx - f.cx) < 0.08);
        const w = f.w * f.w * f.s;
        if (g) {
          g.cx = (g.cx * g.weight + f.cx * w) / (g.weight + w);
          g.weight += w;
          g.n++;
          g.w += (f.w - g.w) / g.n;
        } else groups.push({ cx: f.cx, weight: w, n: 1, w: f.w });
      }
    groups.sort((a, b) => b.weight - a.weight);
    const main = groups[0];
    if (!main) {
      keys.push({ t: s0, x: 0.5, cut: true });
      continue;
    }
    // várias pessoas de verdade no plano (não figurante que aparece num quadro só)
    const cands = groups.filter((g) => g.weight >= main.weight * 0.15 && g.n >= shot.length * 0.3).sort((a, b) => a.cx - b.cx);
    if (cands.length >= 2) {
      const span = cands[cands.length - 1].cx - cands[0].cx;
      if (span < cropW * 0.75) {
        // cabem todos no 9:16: enquadra o grupo, sem escolher ninguém
        keys.push({ t: s0, x: (cands[0].cx + cands[cands.length - 1].cx) / 2, cut: true });
        withFaces += shot.length;
        continue;
      }
      // rosto pequeno demais (< ~40 px na leitura) = boca vira ruído; aí fica no rosto principal
      const readable = cands.filter((c) => c.w * Math.min(SPEAK_MAX_W, info.width) >= 40);
      if (readable.length >= 2 && s1 - s0 >= 1.5 && process.env.CORTIX_SPEAKER !== "0") {
        try {
          const segs = await speakerSegments(src, s0, s1, readable.map((c) => c.cx), main.cx, { w: info.width, h: info.height });
          for (const sg of segs) keys.push({ t: sg.t, x: sg.x, cut: true });
          withFaces += shot.length;
          continue;
        } catch (e) {
          console.error("[reframe] detecção de quem fala falhou, fica no rosto principal:", (e as Error).message);
        }
      }
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
