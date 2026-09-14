import fs from "node:fs";
import path from "node:path";
import { getSessionUserId } from "@/lib/auth";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ass": "text/plain",
  ".json": "application/json",
  ".txt": "text/plain",
};

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const uid = await getSessionUserId();
  if (!uid) return new Response("Não autenticado", { status: 401 });
  const { path: parts } = await ctx.params;
  const base = path.resolve(process.cwd(), process.env.STORAGE_DIR || "./storage");
  const file = path.resolve(base, ...parts);
  if (!file.startsWith(base) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response("Não encontrado", { status: 404 });
  const stat = fs.statSync(file);
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const url = new URL(req.url);
  const download = url.searchParams.get("download");
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };
  if (download) headers["Content-Disposition"] = `attachment; filename="${download.replace(/[^\w.\-]+/g, "_")}"`;
  const range = req.headers.get("range");
  if (range) {
    const m = range.match(/bytes=(\d*)-(\d*)/);
    let start = m && m[1] ? Number(m[1]) : 0;
    let end = m && m[2] ? Number(m[2]) : stat.size - 1;
    if (isNaN(start) || start >= stat.size) start = 0;
    if (isNaN(end) || end >= stat.size) end = stat.size - 1;
    const chunk = end - start + 1;
    const stream = fs.createReadStream(file, { start, end });
    return new Response(stream as unknown as ReadableStream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": String(chunk) },
    });
  }
  const stream = fs.createReadStream(file);
  return new Response(stream as unknown as ReadableStream, { status: 200, headers: { ...headers, "Content-Length": String(stat.size) } });
}
