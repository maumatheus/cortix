import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function findInWinget(prefix: string, exe: string): string | null {
  if (process.platform !== "win32") return null;
  const base = path.join(os.homedir(), "AppData", "Local", "Microsoft", "WinGet", "Packages");
  if (!fs.existsSync(base)) return null;
  for (const dir of fs.readdirSync(base)) {
    if (!dir.toLowerCase().startsWith(prefix.toLowerCase())) continue;
    const full = path.join(base, dir);
    const stack = [full];
    while (stack.length) {
      const cur = stack.pop()!;
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(cur, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        const p = path.join(cur, e.name);
        if (e.isDirectory()) stack.push(p);
        else if (e.name.toLowerCase() === exe.toLowerCase()) return p;
      }
    }
  }
  return null;
}

function resolveBin(envKey: string, name: string, wingetPrefix: string): string {
  const fromEnv = process.env[envKey];
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  const found = findInWinget(wingetPrefix, exe);
  if (found) return found;
  return name; // confia no PATH
}

const cache: { ffmpeg?: string; ffprobe?: string; ytdlp?: string } = {};

export function ffmpegBin() {
  return (cache.ffmpeg ??= resolveBin("FFMPEG_PATH", "ffmpeg", "Gyan.FFmpeg"));
}
export function ffprobeBin() {
  return (cache.ffprobe ??= resolveBin("FFPROBE_PATH", "ffprobe", "Gyan.FFmpeg"));
}
export function ytdlpBin() {
  return (cache.ytdlp ??= resolveBin("YTDLP_PATH", "yt-dlp", "yt-dlp.yt-dlp"));
}

/**
 * Pasta onde mora o ffmpeg, para passar em --ffmpeg-location do yt-dlp.
 * Sem isso o yt-dlp nao consegue juntar video + audio quando o ffmpeg nao esta no PATH,
 * e deixa dois arquivos separados (source.fNNN.mp4 e source.fNNN.m4a).
 * Devolve null quando o ffmpeg vem do PATH (o yt-dlp acha sozinho).
 */
export function ffmpegDir(): string | null {
  const bin = ffmpegBin();
  if (!path.isAbsolute(bin)) return null;
  try {
    if (!fs.existsSync(bin)) return null;
  } catch {
    return null;
  }
  return path.dirname(bin);
}

export function storageDir(...sub: string[]) {
  const base = path.resolve(process.cwd(), process.env.STORAGE_DIR || "./storage");
  const full = path.join(base, ...sub);
  fs.mkdirSync(full, { recursive: true });
  return full;
}

export function fontsDir() {
  return storageDir("fonts");
}

/** Converte um caminho absoluto dentro do storage numa URL servida por /api/files */
export function storageUrl(absPath: string) {
  const base = path.resolve(process.cwd(), process.env.STORAGE_DIR || "./storage");
  const rel = path.relative(base, absPath).split(path.sep).join("/");
  return `/api/files/${rel}`;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function run(
  cmd: string,
  args: string[],
  opts: { onStdout?: (line: string) => void; onStderr?: (line: string) => void; cwd?: string; signal?: AbortSignal } = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, windowsHide: true, signal: opts.signal });
    let stdout = "";
    let stderr = "";
    let outBuf = "";
    let errBuf = "";
    child.stdout.on("data", (d) => {
      const s = d.toString();
      stdout += s;
      if (opts.onStdout) {
        outBuf += s;
        const lines = outBuf.split(/\r?\n|\r/);
        outBuf = lines.pop() || "";
        for (const l of lines) if (l.trim()) opts.onStdout(l);
      }
    });
    child.stderr.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      if (stderr.length > 200_000) stderr = stderr.slice(-100_000);
      if (opts.onStderr) {
        errBuf += s;
        const lines = errBuf.split(/\r?\n|\r/);
        errBuf = lines.pop() || "";
        for (const l of lines) if (l.trim()) opts.onStderr(l);
      }
    });
    child.on("error", (e) => reject(e));
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

export async function checkTools() {
  const out: Record<string, { ok: boolean; path: string; version?: string }> = {};
  for (const [name, bin, args] of [
    ["ffmpeg", ffmpegBin(), ["-version"]],
    ["ffprobe", ffprobeBin(), ["-version"]],
    ["yt-dlp", ytdlpBin(), ["--version"]],
  ] as const) {
    try {
      const r = await run(bin, [...args]);
      out[name] = { ok: r.code === 0, path: bin, version: (r.stdout || r.stderr).split("\n")[0].slice(0, 80) };
    } catch (e) {
      out[name] = { ok: false, path: bin, version: (e as Error).message };
    }
  }
  return out;
}
