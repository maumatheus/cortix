import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ffmpegBin, run, storageDir } from "./bin";
import type { Word } from "./transcript";

/**
 * Transcrição local com whisper.cpp (whisper-cli): palavra por palavra com tempo real, sem API paga.
 * Binário e modelos são baixados no primeiro uso para storage/tools e storage/models
 * (no Windows); em outros sistemas use WHISPER_PATH ou o PATH.
 *
 * Modelo: CORTIX_WHISPER_MODEL = base (padrão, ~6x tempo real num Ryzen 6 núcleos) | small (mais preciso, ~3x mais lento).
 */

const WHISPER_RELEASE = "b5130";
const WHISPER_ZIP = `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_RELEASE}/whisper-bin-x64.zip`;
const MODEL_URL = (name: string) => `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${name}.bin`;
const VAD_URL = "https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin";
const MODELS = { base: 140, small: 460 } as const; // tamanho mínimo em MB, pra detectar download pela metade

export type WhisperModel = keyof typeof MODELS;

export function whisperModel(): WhisperModel {
  const m = process.env.CORTIX_WHISPER_MODEL as WhisperModel;
  return m in MODELS ? m : "base";
}

type Progress = (stage: string, pct: number) => void;

async function download(url: string, dest: string, minBytes: number, onPct?: (pct: number) => void) {
  if (fs.existsSync(dest) && fs.statSync(dest).size >= minBytes) return dest;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`Falha ao baixar ${path.basename(dest)} (HTTP ${res.status})`);
  const total = Number(res.headers.get("content-length") || 0);
  const tmp = dest + ".part";
  const out = fs.createWriteStream(tmp);
  let got = 0;
  let last = -1;
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      if (!out.write(value)) await new Promise<void>((r) => out.once("drain", () => r()));
      const pct = total ? Math.floor((got / total) * 100) : 0;
      if (onPct && pct !== last) onPct((last = pct));
    }
  } finally {
    await new Promise<void>((r) => out.end(r));
  }
  if (got < minBytes) throw new Error(`Download incompleto de ${path.basename(dest)}`);
  fs.renameSync(tmp, dest);
  return dest;
}

let binCache: string | null = null;

async function whisperBin(onProgress?: Progress): Promise<string> {
  if (binCache) return binCache;
  const fromEnv = process.env.WHISPER_PATH?.trim();
  if (fromEnv) return (binCache = fromEnv);
  if (process.platform !== "win32") return (binCache = "whisper-cli");
  const dir = storageDir("tools", `whisper-${WHISPER_RELEASE}`);
  const exe = path.join(dir, "whisper-cli.exe");
  if (!fs.existsSync(exe)) {
    const zip = path.join(dir, "whisper.zip");
    await download(WHISPER_ZIP, zip, 3 * 1024 * 1024, (p) => onProgress?.("Baixando o transcritor (só na 1ª vez)", p));
    // bsdtar do Windows 10+ abre zip; só o executável e as DLLs interessam
    const tar = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");
    const r = await run(tar, ["-xf", zip, "-C", dir, "--strip-components=1", "Release/whisper-cli.exe", "Release/*.dll"]);
    fs.rmSync(zip, { force: true });
    if (!fs.existsSync(exe)) throw new Error("Não consegui extrair o whisper-cli: " + r.stderr.slice(-300));
  }
  return (binCache = exe);
}

async function ensureModels(onProgress?: Progress) {
  const dir = storageDir("models");
  const name = whisperModel();
  const model = await download(MODEL_URL(name), path.join(dir, `ggml-${name}.bin`), MODELS[name] * 1024 * 1024, (p) =>
    onProgress?.(`Baixando o modelo de transcrição ${name} (só na 1ª vez)`, p),
  );
  const vad = await download(VAD_URL, path.join(dir, "ggml-silero-v5.1.2.bin"), 500 * 1024);
  return { model, vad };
}

/** Marcações que o whisper coloca em trechos sem fala: [Música], (risos), ♪ */
const NOISE = /^[[(♪*].*[\])♪*]?$/;

export interface TranscribeOptions {
  /** trecho do vídeo, em segundos */
  start?: number;
  end?: number;
  language?: string | null;
  workDir: string;
  onProgress?: Progress;
}

/** Transcreve um trecho do vídeo. Os tempos voltam absolutos (relativos ao vídeo inteiro). */
export async function transcribeWithWhisper(src: string, o: TranscribeOptions): Promise<Word[]> {
  const bin = await whisperBin(o.onProgress);
  const { model, vad } = await ensureModels(o.onProgress);
  const offset = Math.max(0, o.start ?? 0);
  const tag = `w${Math.round(offset * 1000)}`;
  const wav = path.join(o.workDir, `${tag}.wav`);
  const outBase = path.join(o.workDir, tag);

  const cut = ["-ss", String(offset), ...(o.end && o.end > offset ? ["-t", String(o.end - offset)] : [])];
  const a = await run(ffmpegBin(), ["-y", "-v", "error", ...cut, "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]);
  if (a.code !== 0 || !fs.existsSync(wav)) throw new Error("Falha ao extrair o áudio: " + a.stderr.slice(-300));

  const lang = (o.language || "").toLowerCase().split(/[-_]/)[0] || "auto";
  const threads = Math.max(1, Math.min(16, os.cpus().length - 2));
  const args = ["-m", model, "-f", wav, "-l", lang, "-t", String(threads), "-bs", "1", "-bo", "1", "-ml", "1", "-sow", "-oj", "-of", outBase, "-np", "-pp", "--vad", "-vm", vad];

  try {
    await new Promise<void>((resolve, reject) => {
      const p = spawn(bin, args, { windowsHide: true });
      let err = "";
      const onData = (d: Buffer) => {
        const s = d.toString();
        err = (err + s).slice(-2000);
        const m = s.match(/progress\s*=\s*(\d+)%/g);
        if (m && o.onProgress) o.onProgress("Transcrevendo o áudio", Number(m[m.length - 1].match(/\d+/)![0]));
      };
      p.stdout.on("data", onData);
      p.stderr.on("data", onData);
      p.on("error", (e) => reject(new Error(`whisper-cli não encontrado (${e.message}). Configure WHISPER_PATH.`)));
      p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`whisper-cli saiu com código ${code}: ${err.slice(-300)}`))));
    });
    const json = JSON.parse(fs.readFileSync(outBase + ".json", "utf8")) as { transcription: Array<{ text: string; offsets: { from: number; to: number } }> };
    const words: Word[] = [];
    for (const seg of json.transcription) {
      // "-" no início marca troca de falante; não entra na legenda
      const text = seg.text.trim().replace(/^[-–—]+\s*/, "");
      if (!text || NOISE.test(text)) continue;
      const start = offset + seg.offsets.from / 1000;
      const end = offset + Math.max(seg.offsets.to, seg.offsets.from + 50) / 1000;
      words.push({ text, start, end });
    }
    return words;
  } finally {
    fs.rmSync(wav, { force: true });
    fs.rmSync(outBase + ".json", { force: true });
  }
}

/** Troca as palavras de [start, end] pelas do whisper, mantendo o resto. */
export function replaceRange(words: Word[], start: number, end: number, fresh: Word[]): Word[] {
  const before = words.filter((w) => w.end <= start);
  const after = words.filter((w) => w.start >= end);
  return [...before, ...fresh.filter((w) => w.start >= start && w.end <= end + 0.5), ...after];
}

export function whisperDisabled() {
  return process.env.CORTIX_WHISPER === "0";
}
