import fs from "node:fs";
import path from "node:path";
import { ffmpegBin, ffprobeBin, fontsDir, run } from "./bin";
import { buildAss } from "./ass";
import type { CaptionStyle } from "../caption-styles";
import type { CaptionGroup } from "./transcript";
import { hasAnyEffect, type EffectsConfig } from "../effects";
import { buildAudioGraph, buildEffects } from "./effects";

export interface ProbeInfo {
  width: number;
  height: number;
  duration: number;
  fps: number;
  hasAudio: boolean;
}

export async function probe(file: string): Promise<ProbeInfo> {
  const r = await run(ffprobeBin(), ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file]);
  if (r.code !== 0) throw new Error("ffprobe falhou: " + r.stderr.slice(0, 200));
  const j = JSON.parse(r.stdout);
  const v = (j.streams || []).find((s: { codec_type: string }) => s.codec_type === "video") || {};
  const a = (j.streams || []).find((s: { codec_type: string }) => s.codec_type === "audio");
  const [num, den] = String(v.r_frame_rate || "30/1").split("/").map(Number);
  return {
    width: v.width || 1280,
    height: v.height || 720,
    duration: Number(j.format?.duration) || Number(v.duration) || 0,
    fps: den ? num / den : 30,
    hasAudio: !!a,
  };
}

/** Escapa caminho para uso dentro de filtros do ffmpeg (Windows friendly). */
function filterPath(p: string) {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

export async function makeThumbnail(src: string, atSec: number, out: string, width = 480) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const r = await run(ffmpegBin(), ["-y", "-v", "error", "-ss", String(Math.max(0, atSec)), "-i", src, "-frames:v", "1", "-vf", `scale=${width}:-2`, out]);
  if (r.code !== 0) throw new Error("thumbnail falhou: " + r.stderr.slice(0, 200));
  return out;
}

/** Gera uma miniatura já no recorte vertical do layout. */
export async function makeVerticalThumbnail(src: string, atSec: number, out: string, layout: string, width = 360) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const height = Math.round((width * 16) / 9);
  const vf = layoutFilter(layout, width, height);
  const r = await run(ffmpegBin(), ["-y", "-v", "error", "-ss", String(Math.max(0, atSec)), "-i", src, "-frames:v", "1", "-filter_complex", `${vf}[vout]`, "-map", "[vout]", out]);
  if (r.code !== 0) throw new Error("thumbnail falhou: " + r.stderr.slice(0, 200));
  return out;
}

/** Filtro de layout: recebe [0:v] e produz um fluxo W x H (9:16). Retorna uma cadeia sem o rótulo final. */
export function layoutFilter(layout: string, W: number, H: number): string {
  switch (layout) {
    case "center":
      return `[0:v]split=2[bg][fg];[bg]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=24:8,eq=brightness=-0.08[bgb];[fg]scale=${W}:-2[fgs];[bgb][fgs]overlay=(W-w)/2:(H-h)/2,format=yuv420p`;
    case "split":
      return `[0:v]split=2[a][b];[a]crop=iw/2:ih:0:0,scale=${W}:${H / 2}:force_original_aspect_ratio=increase,crop=${W}:${H / 2}[at];[b]crop=iw/2:ih:iw/2:0,scale=${W}:${H / 2}:force_original_aspect_ratio=increase,crop=${W}:${H / 2}[bb];[at][bb]vstack,format=yuv420p`;
    case "react":
      return `[0:v]split=2[a][b];[a]scale=${W}:-2[top];[b]crop=ih*9/16*0.9:ih*0.9:(iw-ih*9/16*0.9)/2:ih*0.05,scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}[bg];[bg][top]overlay=0:0,format=yuv420p`;
    case "split-vertical":
      return `[0:v]split=2[a][b];[a]crop=iw/2:ih:0:0,scale=${W / 2}:${H}:force_original_aspect_ratio=increase,crop=${W / 2}:${H}[al];[b]crop=iw/2:ih:iw/2:0,scale=${W / 2}:${H}:force_original_aspect_ratio=increase,crop=${W / 2}:${H}[br];[al][br]hstack,format=yuv420p`;
    case "tri-split":
      return `[0:v]split=3[a][b][c];[a]crop=iw/3:ih:0:0,scale=${W}:${Math.round(H / 3)}:force_original_aspect_ratio=increase,crop=${W}:${Math.round(H / 3)}[t1];[b]crop=iw/3:ih:iw/3:0,scale=${W}:${Math.round(H / 3)}:force_original_aspect_ratio=increase,crop=${W}:${Math.round(H / 3)}[t2];[c]crop=iw/3:ih:2*iw/3:0,scale=${W}:${H - 2 * Math.round(H / 3)}:force_original_aspect_ratio=increase,crop=${W}:${H - 2 * Math.round(H / 3)}[t3];[t1][t2][t3]vstack=inputs=3,format=yuv420p`;
    case "single":
    default:
      return `[0:v]crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=${W}:${H},format=yuv420p`;
  }
}

export interface RenderOptions {
  src: string;
  start: number;
  end: number;
  layout: string;
  style: CaptionStyle;
  groups: CaptionGroup[]; // tempos absolutos do vídeo original
  out: string;
  width?: number;
  height?: number;
  crf?: number;
  preset?: string;
  watermark?: boolean;
  watermarkText?: string;
  hook?: string | null;
  captionsEnabled?: boolean;
  /** Efeitos de transformação (zoom, cor, marca, velocidade, música). */
  effects?: EffectsConfig | null;
  primaryColor?: string;
  onProgress?: (pct: number) => void;
}

export async function renderClip(o: RenderOptions) {
  const W = o.width ?? 1080;
  const H = o.height ?? Math.round((W * 16) / 9);
  const dur = Math.max(0.5, o.end - o.start);
  fs.mkdirSync(path.dirname(o.out), { recursive: true });

  const fonts = fontsDir();
  const fx = o.effects && hasAnyEffect(o.effects) ? buildEffects({ effects: o.effects, W, H, dur, fps: 30, fontsDir: fonts, primaryColor: o.primaryColor }) : null;
  const filters: string[] = [layoutFilter(o.layout, W, H), ...(fx?.preCaption ?? [])];
  const captions = o.captionsEnabled !== false && o.style.highlightMode !== undefined && o.style.id !== "none";
  let assFile: string | null = null;
  if (captions || o.hook) {
    const rel: CaptionGroup[] = o.groups
      .filter((g) => g.end > o.start && g.start < o.end)
      .map((g) => ({
        start: Math.max(0, g.start - o.start),
        end: Math.min(dur, g.end - o.start),
        words: g.words.map((w) => ({ text: w.text, start: Math.max(0, w.start - o.start), end: Math.min(dur, w.end - o.start) })),
      }));
    const ass = buildAss({ style: o.style, groups: captions ? rel : [], width: W, height: H, hook: o.hook, hookSeconds: 3 });
    assFile = o.out.replace(/\.mp4$/i, "") + ".ass";
    fs.writeFileSync(assFile, ass, "utf8");
    filters.push(`subtitles='${filterPath(assFile)}':fontsdir='${filterPath(fonts)}'`);
  }
  if (o.watermark) {
    const fontFile = path.join(fonts, "Montserrat-Black.ttf");
    const text = (o.watermarkText || "Cortix").replace(/'/g, "");
    const fontArg = fs.existsSync(fontFile) ? `fontfile='${filterPath(fontFile)}':` : "";
    filters.push(
      `drawtext=${fontArg}text='${text}':fontsize=${Math.round(W * 0.045)}:fontcolor=white@0.55:borderw=2:bordercolor=black@0.4:x=w-tw-${Math.round(W * 0.04)}:y=h-th-${Math.round(H * 0.16)}`,
    );
  }
  if (fx) filters.push(...fx.postCaption, ...fx.timing);
  let graph = filters.join(",") + "[vout]";
  const outDur = fx?.outDur ?? dur;

  // Áudio: só passa por filtro quando há velocidade ou trilha de fundo
  const music = o.effects?.musicPath && fs.existsSync(o.effects.musicPath) ? o.effects.musicPath : null;
  const needsAudioGraph = !!o.effects && (o.effects.speed !== 1 || !!music);
  const extraInputs: string[] = [];
  const audioMap: string[] = ["-map", "0:a?"];
  if (needsAudioGraph && o.effects) {
    const info = await probe(o.src);
    if (music) extraInputs.push("-stream_loop", "-1", "-i", music);
    const ag = buildAudioGraph(o.effects, info.hasAudio, music ? 1 : null);
    if (ag) {
      graph += ";" + ag;
      audioMap.splice(0, audioMap.length, "-map", "[aout]");
    }
  }

  const args = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    o.start.toFixed(3),
    "-t",
    dur.toFixed(3),
    "-i",
    o.src,
    ...extraInputs,
    "-filter_complex",
    graph,
    "-map",
    "[vout]",
    ...audioMap,
    "-t",
    (outDur + 0.05).toFixed(3),
    "-c:v",
    "libx264",
    "-preset",
    o.preset || "veryfast",
    "-crf",
    String(o.crf ?? 23),
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-progress",
    "pipe:1",
    "-nostats",
    o.out,
  ];
  const r = await run(ffmpegBin(), args, {
    onStdout: (line) => {
      const m = line.match(/out_time_ms=(\d+)/);
      if (m && o.onProgress) {
        const pct = Math.min(99, Math.round((Number(m[1]) / 1_000_000 / outDur) * 100));
        o.onProgress(pct);
      }
    },
  });
  if (r.code !== 0) throw new Error("ffmpeg falhou: " + r.stderr.split("\n").filter(Boolean).slice(-3).join(" | ").slice(0, 400));
  o.onProgress?.(100);
  return o.out;
}
