import fs from "node:fs";
import path from "node:path";
import type { EffectsConfig } from "../effects";

/** Cor hex (#RRGGBB) → formato aceito pelo ffmpeg (0xRRGGBB). */
function ffColor(hex: string, alpha?: number) {
  const h = (hex || "#FFFFFF").replace("#", "").slice(0, 6).padEnd(6, "0");
  return `0x${h}` + (alpha !== undefined ? `@${alpha}` : "");
}

/** Texto seguro para drawtext (remove caracteres que quebram o filtergraph). */
function ffText(t: string) {
  return t.replace(/[\\'":%;,\[\]]/g, "").replace(/\s+/g, " ").trim();
}

function filterPath(p: string) {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

export interface EffectsBuildInput {
  effects: EffectsConfig;
  W: number;
  H: number;
  dur: number; // duração do trecho original (antes da velocidade)
  fps: number;
  fontsDir: string;
  primaryColor?: string;
}

export interface EffectsBuild {
  /** Filtros de vídeo aplicados ANTES das legendas (mexem na imagem) */
  preCaption: string[];
  /** Filtros aplicados DEPOIS das legendas (overlays de marca) — ainda no tempo original */
  postCaption: string[];
  /** Filtros de tempo (setpts) — sempre por último no vídeo */
  timing: string[];
  /** Duração final do corte em segundos (após velocidade) */
  outDur: number;
}

/** Zoom dinâmico via zoompan: d=1 gera 1 frame de saída por frame de entrada. */
function zoomFilter(e: EffectsConfig, W: number, H: number, fps: number) {
  const framesPerCycle = Math.max(1, Math.round(e.zoomIntervalSec * fps));
  const A = e.zoomAmount;
  const z =
    e.zoom === "punch"
      ? `1+${A}*mod(floor(on/${framesPerCycle})\\,2)`
      : `1+${A}*(0.5-0.5*cos(2*PI*on/${framesPerCycle}))`;
  return `zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${fps}`;
}

function gradeFilters(g: EffectsConfig["grade"]): string[] {
  switch (g) {
    case "warm":
      return ["eq=contrast=1.06:saturation=1.12", "colorbalance=rs=0.05:gs=0.01:bs=-0.05"];
    case "punchy":
      return ["eq=contrast=1.12:saturation=1.28:gamma=0.97", "unsharp=5:5:0.6:5:5:0"];
    case "cinematic":
      return ["eq=contrast=1.1:saturation=0.9", "colorbalance=rs=-0.04:bs=0.06:rh=0.04:bh=-0.04"];
    case "cool":
      return ["eq=contrast=1.06:saturation=1.05", "colorbalance=rs=-0.05:bs=0.06"];
    default:
      return [];
  }
}

export function buildEffects(i: EffectsBuildInput): EffectsBuild {
  const { effects: e, W, H, dur, fps } = i;
  const pre: string[] = [];
  const post: string[] = [];
  const timing: string[] = [];

  if (e.mirror) pre.push("hflip");
  if (e.zoom !== "none" && e.zoomAmount > 0) pre.push(zoomFilter(e, W, H, fps));
  pre.push(...gradeFilters(e.grade));
  if (e.vignette) pre.push("vignette=angle=PI/4.5");

  const fontFile = path.join(i.fontsDir, "Montserrat-Black.ttf");
  const fontArg = fs.existsSync(fontFile) ? `fontfile='${filterPath(fontFile)}':` : "";
  const barH = Math.max(6, Math.round(H * 0.008));

  if (e.handle) {
    const text = ffText(e.handle.startsWith("@") ? e.handle : `@${e.handle}`);
    if (text) {
      post.push(
        `drawtext=${fontArg}text='${text}':fontsize=${Math.round(W * 0.034)}:fontcolor=${ffColor(e.handleColor)}:box=1:boxcolor=black@0.45:boxborderw=${Math.round(W * 0.012)}:x=${Math.round(W * 0.04)}:y=h-th-${Math.round(H * 0.07)}`,
      );
    }
  }
  if (e.progressBar) {
    post.push(`drawbox=x=0:y=${H - barH}:w='iw*t/${dur.toFixed(3)}':h=${barH}:color=${ffColor(e.progressColor, 0.95)}:t=fill`);
  }
  if (e.endCardText) {
    const text = ffText(e.endCardText);
    const from = Math.max(0, dur - e.endCardSeconds).toFixed(3);
    if (text) {
      post.push(
        `drawtext=${fontArg}text='${text}':fontsize=${Math.round(W * 0.07)}:fontcolor=white:borderw=${Math.round(W * 0.006)}:bordercolor=black@0.9:box=1:boxcolor=${ffColor(i.primaryColor || "#7c3aed", 0.85)}:boxborderw=${Math.round(W * 0.025)}:x=(w-tw)/2:y=(h-th)/2:enable='gte(t,${from})'`,
      );
    }
  }

  let outDur = dur;
  if (e.speed !== 1) {
    timing.push(`setpts=PTS/${e.speed}`);
    outDur = dur / e.speed;
  }

  return { preCaption: pre, postCaption: post, timing, outDur };
}

/** Cadeia de áudio. Retorna null quando não precisa de filter (áudio passa direto). */
export function buildAudioGraph(e: EffectsConfig, hasSourceAudio: boolean, musicInputIndex: number | null): string | null {
  const parts: string[] = [];
  let srcLabel: string | null = null;
  if (hasSourceAudio) {
    parts.push(`[0:a]${e.speed !== 1 ? `atempo=${e.speed}` : "anull"}[a0]`);
    srcLabel = "[a0]";
  }
  if (musicInputIndex !== null) {
    parts.push(`[${musicInputIndex}:a]volume=${e.musicVolume}[am]`);
    if (srcLabel) {
      parts.push(`${srcLabel}[am]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]`);
    } else {
      parts.push(`[am]anull[aout]`);
    }
    return parts.join(";");
  }
  if (!srcLabel) return null;
  if (e.speed === 1) return null;
  return parts.join(";").replace("[a0]", "[aout]");
}
