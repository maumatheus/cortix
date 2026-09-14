import { db } from "@/lib/db";
import { fail, ok, withUser } from "@/lib/api";
import { run, ytdlpBin } from "@/lib/video/bin";

/** Para canais do YouTube, aponta pra página /live; vídeos e outros links ficam como estão. */
function liveProbeUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (host !== "youtube.com" && host !== "youtu.be") return null;
  if (host === "youtu.be" || u.pathname.startsWith("/watch") || u.pathname.startsWith("/live/") || u.pathname.startsWith("/shorts/")) return raw;
  const path = u.pathname.replace(/\/+$/, "");
  if (/\/live$/.test(path)) return `https://www.youtube.com${path}`;
  return `https://www.youtube.com${path}/live`;
}

/** Consulta o yt-dlp e devolve true se está ao vivo, false se não, null se não deu pra saber. */
async function detectLive(url: string): Promise<boolean | null> {
  const probe = liveProbeUrl(url);
  if (!probe) return null;
  try {
    const r = await run(ytdlpBin(), ["--print", "is_live", "--no-warnings", "--no-playlist", "--playlist-items", "1", "--skip-download", probe], { signal: AbortSignal.timeout(25_000) });
    if (r.code !== 0) return null;
    const out = r.stdout.trim().split(/\r?\n/).pop()?.trim().toLowerCase();
    if (out === "true") return true;
    if (out === "false" || out === "none" || out === "na") return false;
    return null;
  } catch {
    return null;
  }
}

/** Alterna idle ↔ watching. Ao começar a observar, tenta detectar se o canal já está ao vivo. */
export const POST = withUser(async ({ params, user }) => {
  const m = await db.liveMonitor.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!m) return fail("Monitoramento não encontrado", 404);
  if (m.status === "watching" || m.status === "live") {
    const monitor = await db.liveMonitor.update({ where: { id: m.id }, data: { status: "idle" } });
    return ok({ monitor, detected: null });
  }
  const detected = await detectLive(m.channelUrl);
  const monitor = await db.liveMonitor.update({ where: { id: m.id }, data: { status: detected === true ? "live" : "watching" } });
  return ok({ monitor, detected });
});
