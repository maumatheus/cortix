import fs from "node:fs";
import { db } from "./db";
import { uploadYoutubeVideo, youtubeAccessToken } from "./social/youtube";
import { startUploadPost, uploadPostStatus } from "./social/uploadpost";
import { channelBlackout, resolveChannel, validateChannelSchedule } from "./schedule-rules";
import { parsePostMeta, type YoutubeMeta } from "./post-meta";

/** Prefixo do externalId enquanto o envio assíncrono (Upload-Post) ainda está rolando lá. */
export const PENDING_PREFIX = "req:";

/**
 * Publicador: pega os posts cujo horário já passou e publica.
 * - Conta conectada por OAuth (YouTube) → upload de verdade pela API oficial.
 * - Conta conectada via Upload-Post (TikTok/Instagram) → envio assíncrono; as rodadas seguintes consultam o status.
 * - Conta simulada / sem conta → só marca como publicado (comportamento antigo, sem falar com a rede).
 * Também dá baixa nos itens de launcher vencidos.
 */
let rodando: Promise<unknown> | null = null;

export function publishDuePosts(userId?: string, opts: { now?: Date } = {}) {
  // uma rodada por vez: GETs de página e o timer de fundo podem chamar juntos
  if (!rodando) rodando = rodada(userId, opts.now ?? new Date()).finally(() => (rodando = null));
  return rodando as ReturnType<typeof rodada>;
}

async function rodada(userId: string | undefined, now: Date) {
  const due = await db.scheduledPost.findMany({
    where: { status: "scheduled", scheduledAt: { lte: now }, ...(userId ? { userId } : {}) },
    select: { id: true, shortId: true, platform: true, caption: true, meta: true, user: { select: { channel: true } }, socialAccount: { select: { id: true, connection: true, platform: true, externalId: true, channel: true } } },
  });

  let published = 0;
  let failed = 0;
  let blocked = 0;
  for (const post of due) {
    // trava eleitoral: dentro da janela do canal nada sai, nem simulado; o post falha e precisa ser reagendado
    const channel = resolveChannel(post.socialAccount?.channel, post.user.channel);
    if (channelBlackout(channel, now)) {
      const msg = validateChannelSchedule(channel, [now])!;
      await db.scheduledPost.updateMany({ where: { id: post.id, status: "scheduled" }, data: { status: "failed", error: msg.slice(0, 500) } });
      console.warn(`[publisher] post ${post.id} bloqueado: ${msg}`);
      blocked++;
      continue;
    }
    const real = post.socialAccount?.connection === "oauth" || post.socialAccount?.connection === "uploadpost";
    if (!real) {
      await db.scheduledPost.update({ where: { id: post.id }, data: { status: "published", publishedAt: now } });
      if (post.shortId) await db.short.update({ where: { id: post.shortId }, data: { isPublished: true, isScheduled: false } }).catch(() => {});
      published++;
      continue;
    }
    // trava o post (evita upload duplicado se duas rodadas se cruzarem, inclusive entre processos)
    const lock = await db.scheduledPost.updateMany({ where: { id: post.id, status: "scheduled" }, data: { status: "publishing" } });
    if (!lock.count) continue;
    try {
      const res = await publishReal(post);
      if ("requestId" in res) {
        // ainda subindo lá: fica em "publishing" até o status fechar
        await db.scheduledPost.update({ where: { id: post.id }, data: { externalId: PENDING_PREFIX + res.requestId, error: null } });
        continue;
      }
      await markPublished(post.id, post.shortId, res.id, res.url, "warning" in res ? res.warning : null);
      published++;
    } catch (e) {
      const msg = (e as Error).message || "Erro desconhecido";
      console.error(`[publisher] post ${post.id} falhou:`, msg);
      await db.scheduledPost.update({ where: { id: post.id }, data: { status: "failed", error: msg.slice(0, 500) } });
      failed++;
    }
  }

  // envios assíncronos em andamento
  const pending = await db.scheduledPost.findMany({
    where: { status: "publishing", externalId: { startsWith: PENDING_PREFIX }, ...(userId ? { userId } : {}) },
    select: { id: true, shortId: true, platform: true, externalId: true, scheduledAt: true },
  });
  for (const p of pending) {
    try {
      const st = await uploadPostStatus(p.externalId!.slice(PENDING_PREFIX.length), p.platform);
      if (st.state === "done") {
        await markPublished(p.id, p.shortId, st.id, st.url);
        published++;
      } else if (st.state === "failed") {
        await db.scheduledPost.update({ where: { id: p.id }, data: { status: "failed", error: st.error.slice(0, 500) } });
        failed++;
      } else if (Date.now() - p.scheduledAt.getTime() > 6 * 3600_000) {
        await db.scheduledPost.update({ where: { id: p.id }, data: { status: "failed", error: "O Upload-Post não confirmou a publicação em 6 horas. Confira no painel deles." } });
        failed++;
      }
    } catch (e) {
      console.error(`[publisher] status do post ${p.id}:`, (e as Error).message); // tenta de novo na próxima rodada
    }
  }

  const dueItems = await db.launcherItem.findMany({
    where: { status: { not: "posted" }, postAt: { lte: now }, ...(userId ? { launcher: { userId } } : {}) },
    select: { id: true, shortId: true },
  });
  if (dueItems.length) {
    await db.launcherItem.updateMany({ where: { id: { in: dueItems.map((i) => i.id) } }, data: { status: "posted" } });
    await db.short.updateMany({ where: { id: { in: dueItems.map((i) => i.shortId) } }, data: { isPublished: true } });
  }
  return { posts: published, failed, blocked, launcherItems: dueItems.length };
}

/** `warning`: publicou, mas algo acessório falhou (ex.: thumbnail); fica em `error` pra quem consultar o status. */
async function markPublished(id: string, shortId: string | null, externalId: string | null, externalUrl: string | null, warning: string | null = null) {
  const error = warning ? `Publicado com aviso: ${warning}`.slice(0, 500) : null;
  await db.scheduledPost.update({ where: { id }, data: { status: "published", publishedAt: new Date(), externalId, externalUrl, error } });
  if (shortId) await db.short.update({ where: { id: shortId }, data: { isPublished: true, isScheduled: false } }).catch(() => {});
}

async function publishReal(post: {
  shortId: string | null;
  platform: string;
  caption: string;
  meta: string | null;
  socialAccount: { id: string; platform: string; connection: string; externalId: string | null } | null;
}): Promise<{ id: string | null; url: string | null; warning?: string | null } | { requestId: string }> {
  if (!post.shortId) throw new Error("Post sem corte vinculado");
  const short = await db.short.findUnique({ where: { id: post.shortId }, select: { title: true, hook: true } });
  if (!short) throw new Error("O corte deste post foi excluído");
  const render = await db.render.findFirst({ where: { shortId: post.shortId, status: "done", filePath: { not: null } }, orderBy: { completedAt: "desc" } });
  if (!render?.filePath || !fs.existsSync(render.filePath)) throw new Error("O corte ainda não foi renderizado (ou o arquivo do render sumiu). Renderize e reagende.");

  const yt = parsePostMeta(post.meta).youtube;
  if (post.socialAccount!.connection === "uploadpost") {
    if (!post.socialAccount!.externalId) throw new Error("Conta sem perfil do Upload-Post. Reconecte a conta.");
    const r = await startUploadPost({ profile: post.socialAccount!.externalId, platform: post.socialAccount!.platform, filePath: render.filePath, caption: post.caption, title: yt?.title || short.title });
    return r.done ? { id: r.id, url: r.url } : { requestId: r.requestId };
  }
  switch (post.socialAccount!.platform) {
    case "youtube": {
      const token = await youtubeAccessToken(post.socialAccount!.id);
      const { title, description, tags } = youtubeTexts(post.caption, short.title, yt);
      return uploadYoutubeVideo(token, {
        filePath: render.filePath,
        title,
        description,
        tags,
        categoryId: yt?.categoryId,
        publishAt: yt?.publishAt,
        privacy: yt?.privacy,
        madeForKids: yt?.madeForKids ?? false,
        thumbnailPath: yt?.thumbnailPath,
        playlistId: yt?.playlistId,
      });
    }
    default:
      throw new Error(`Publicação real no ${post.socialAccount!.platform} ainda não está disponível`);
  }
}

/**
 * Título = meta.title, ou 1ª linha da legenda, ou título do corte (máx. 100 caracteres).
 * Descrição = meta.description ou a legenda, com #Shorts. Tags = meta.tags ou as hashtags da legenda.
 */
export function youtubeTexts(caption: string, fallbackTitle: string, yt?: YoutubeMeta) {
  const linhas = caption.trim().split(/\r?\n/);
  let title = (yt?.title || linhas[0] || fallbackTitle).replace(/[<>]/g, "").trim() || fallbackTitle;
  if (title.length > 100) title = title.slice(0, 97).trimEnd() + "...";
  let description = yt?.description?.trim() || caption.trim() || fallbackTitle;
  if (!/#shorts\b/i.test(description)) description += "\n\n#Shorts";
  const tags = yt?.tags?.length ? yt.tags.slice(0, 30) : Array.from(new Set((caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.slice(1)))).slice(0, 15);
  return { title, description: description.replace(/[<>]/g, "").slice(0, 5000), tags };
}
