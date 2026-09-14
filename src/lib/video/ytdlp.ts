import fs from "node:fs";
import path from "node:path";
import { run, ytdlpBin } from "./bin";

export interface VideoMetadata {
  platform: "youtube" | "twitch" | "kick" | "drive" | "other";
  videoId: string;
  url: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  channelTitle: string | null;
  channelId: string | null;
  durationSec: number;
  language: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  publishedAt: string | null;
  tags: string[];
  estimatedClips: number;
}

export class InvalidUrlError extends Error {
  status = 400;
}

export function detectPlatform(raw: string): { platform: VideoMetadata["platform"]; videoId: string; url: string } {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new InvalidUrlError("URL inválida: formato não reconhecido");
  }
  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (host === "youtube.com" || host === "youtu.be" || host === "music.youtube.com") {
    let id = "";
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (u.pathname.startsWith("/watch")) id = u.searchParams.get("v") || "";
    else if (u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/live/") || u.pathname.startsWith("/embed/"))
      id = u.pathname.split("/")[2] || "";
    if (!id) throw new InvalidUrlError("URL inválida: ID do vídeo não encontrado");
    return { platform: "youtube", videoId: id, url: `https://www.youtube.com/watch?v=${id}` };
  }
  if (host === "twitch.tv") {
    const m = u.pathname.match(/\/videos\/(\d+)/);
    if (!m) throw new InvalidUrlError("URL inválida: só VODs da Twitch (twitch.tv/videos/ID) são aceitos");
    return { platform: "twitch", videoId: m[1], url: raw.trim() };
  }
  if (host === "kick.com") {
    const m = u.pathname.match(/\/video\/([\w-]+)/);
    if (!m) throw new InvalidUrlError("URL inválida: só VODs do Kick (kick.com/video/ID) são aceitos");
    return { platform: "kick", videoId: m[1], url: raw.trim() };
  }
  if (host === "drive.google.com") {
    const m = u.pathname.match(/\/file\/d\/([\w-]+)/) || [null, u.searchParams.get("id")];
    if (!m[1]) throw new InvalidUrlError("URL inválida: link do Google Drive não reconhecido");
    return { platform: "drive", videoId: m[1], url: `https://drive.google.com/uc?id=${m[1]}&export=download` };
  }
  throw new InvalidUrlError("URL inválida: formato não reconhecido");
}

export function estimateClips(durationSec: number, clipDuration: string) {
  const avg = clipDuration === "auto" ? 50 : Number(clipDuration) || 50;
  return Math.max(1, Math.min(40, Math.round((durationSec * 0.45) / avg)));
}

export async function fetchMetadata(raw: string): Promise<VideoMetadata> {
  const { platform, videoId, url } = detectPlatform(raw);
  const r = await run(ytdlpBin(), ["-J", "--no-playlist", "--no-warnings", url]);
  if (r.code !== 0) {
    const msg = r.stderr.split("\n").find((l) => /ERROR/.test(l)) || "Não foi possível obter os dados do vídeo";
    throw new InvalidUrlError(msg.replace(/^ERROR:\s*/, "").slice(0, 200));
  }
  const j = JSON.parse(r.stdout);
  const duration = Number(j.duration) || 0;
  return {
    platform,
    videoId: String(j.id || videoId),
    url,
    title: j.title || "Vídeo sem título",
    description: j.description || "",
    thumbnailUrl: j.thumbnail || (Array.isArray(j.thumbnails) ? j.thumbnails.at(-1)?.url : null) || null,
    channelTitle: j.channel || j.uploader || null,
    channelId: j.channel_id || j.uploader_id || null,
    durationSec: duration,
    language: j.language || null,
    views: j.view_count ?? null,
    likes: j.like_count ?? null,
    comments: j.comment_count ?? null,
    publishedAt: j.upload_date ? `${j.upload_date.slice(0, 4)}-${j.upload_date.slice(4, 6)}-${j.upload_date.slice(6, 8)}` : null,
    tags: Array.isArray(j.tags) ? j.tags.slice(0, 30) : [],
    estimatedClips: estimateClips(duration, "auto"),
  };
}

export async function downloadVideo(url: string, outDir: string, onProgress?: (pct: number) => void, maxHeight = 720) {
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, "source.mp4");
  if (fs.existsSync(out) && fs.statSync(out).size > 0) return out;
  const tmpl = path.join(outDir, "source.%(ext)s");
  const r = await run(
    ytdlpBin(),
    [
      "--no-playlist",
      "--no-warnings",
      "--newline",
      "-f",
      `bv*[height<=${maxHeight}][ext=mp4]+ba[ext=m4a]/b[height<=${maxHeight}][ext=mp4]/bv*[height<=${maxHeight}]+ba/b`,
      "--merge-output-format",
      "mp4",
      "-o",
      tmpl,
      url,
    ],
    {
      onStdout: (line) => {
        const m = line.match(/\[download\]\s+([\d.]+)%/);
        if (m && onProgress) onProgress(Number(m[1]));
      },
    },
  );
  if (r.code !== 0 || !fs.existsSync(out)) {
    const alt = fs.readdirSync(outDir).find((f) => f.startsWith("source.") && !f.endsWith(".part"));
    if (alt && r.code === 0) return path.join(outDir, alt);
    throw new Error("Falha ao baixar o vídeo: " + (r.stderr.split("\n").find((l) => /ERROR/.test(l)) || "erro desconhecido").slice(0, 300));
  }
  return out;
}

/** Baixa legendas automáticas (json3) e devolve o caminho do arquivo, ou null. */
export async function downloadSubtitles(url: string, outDir: string, preferred: string[] = ["pt", "pt-BR", "en"]) {
  fs.mkdirSync(outDir, { recursive: true });
  const existing = fs.readdirSync(outDir).find((f) => f.startsWith("subs.") && f.endsWith(".json3"));
  if (existing) return path.join(outDir, existing);
  const langs = [...preferred, "pt-orig", "en-orig", ".*orig", ".*"].join(",");
  await run(ytdlpBin(), [
    "--no-playlist",
    "--no-warnings",
    "--skip-download",
    "--write-subs",
    "--write-auto-subs",
    "--sub-langs",
    langs,
    "--sub-format",
    "json3",
    "-o",
    path.join(outDir, "subs"),
    url,
  ]);
  const files = fs.readdirSync(outDir).filter((f) => f.startsWith("subs.") && f.endsWith(".json3"));
  if (!files.length) return null;
  // prioriza idioma preferido e legendas "orig" (não traduzidas)
  const score = (f: string) => {
    const lang = f.replace(/^subs\./, "").replace(/\.json3$/, "");
    let s = 0;
    preferred.forEach((p, i) => {
      if (lang.startsWith(p)) s += 100 - i * 10;
    });
    if (lang.includes("orig")) s += 5;
    return s;
  };
  files.sort((a, b) => score(b) - score(a));
  return path.join(outDir, files[0]);
}
