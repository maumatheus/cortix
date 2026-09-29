import fs from "node:fs";
import { db } from "./db";
import { uploadYoutubeVideo, youtubeAccessToken } from "./social/youtube";

/**
 * Publicador: pega os posts cujo horário já passou e publica.
 * - Conta conectada por OAuth (hoje: YouTube) → upload de verdade pela API oficial.
 * - Conta simulada / sem conta → só marca como publicado (comportamento antigo, sem falar com a rede).
 * Também dá baixa nos itens de launcher vencidos.
 */
let rodando: Promise<unknown> | null = null;

export function publishDuePosts(userId?: string) {
  // uma rodada por vez: GETs de página e o timer de fundo podem chamar juntos
  if (!rodando) rodando = rodada(userId).finally(() => (rodando = null));
  return rodando;
}

async function rodada(userId?: string) {
  const now = new Date();
  const due = await db.scheduledPost.findMany({
    where: { status: "scheduled", scheduledAt: { lte: now }, ...(userId ? { userId } : {}) },
    select: { id: true, shortId: true, platform: true, caption: true, socialAccount: { select: { id: true, connection: true, platform: true } } },
  });

  let published = 0;
  let failed = 0;
  for (const post of due) {
    const real = post.socialAccount?.connection === "oauth";
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
      await db.scheduledPost.update({ where: { id: post.id }, data: { status: "published", publishedAt: new Date(), externalId: res.id, externalUrl: res.url, error: null } });
      if (post.shortId) await db.short.update({ where: { id: post.shortId }, data: { isPublished: true, isScheduled: false } }).catch(() => {});
      published++;
    } catch (e) {
      const msg = (e as Error).message || "Erro desconhecido";
      console.error(`[publisher] post ${post.id} falhou:`, msg);
      await db.scheduledPost.update({ where: { id: post.id }, data: { status: "failed", error: msg.slice(0, 500) } });
      failed++;
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
  return { posts: published, failed, launcherItems: dueItems.length };
}

async function publishReal(post: { shortId: string | null; platform: string; caption: string; socialAccount: { id: string; platform: string } | null }) {
  if (!post.shortId) throw new Error("Post sem corte vinculado");
  const short = await db.short.findUnique({ where: { id: post.shortId }, select: { title: true, hook: true } });
  if (!short) throw new Error("O corte deste post foi excluído");
  const render = await db.render.findFirst({ where: { shortId: post.shortId, status: "done", filePath: { not: null } }, orderBy: { completedAt: "desc" } });
  if (!render?.filePath || !fs.existsSync(render.filePath)) throw new Error("O corte ainda não foi renderizado (ou o arquivo do render sumiu). Renderize e reagende.");

  switch (post.socialAccount!.platform) {
    case "youtube": {
      const token = await youtubeAccessToken(post.socialAccount!.id);
      const { title, description, tags } = youtubeTexts(post.caption, short.title);
      return uploadYoutubeVideo(token, { filePath: render.filePath, title, description, tags });
    }
    default:
      throw new Error(`Publicação real no ${post.socialAccount!.platform} ainda não está disponível`);
  }
}

/** Título = 1ª linha da legenda (ou título do corte), máx. 100 caracteres; descrição com #Shorts. */
export function youtubeTexts(caption: string, fallbackTitle: string) {
  const linhas = caption.trim().split(/\r?\n/);
  let title = (linhas[0] || fallbackTitle).replace(/[<>]/g, "").trim() || fallbackTitle;
  if (title.length > 100) title = title.slice(0, 97).trimEnd() + "...";
  let description = caption.trim() || fallbackTitle;
  if (!/#shorts\b/i.test(description)) description += "\n\n#Shorts";
  const tags = Array.from(new Set((caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.slice(1)))).slice(0, 15);
  return { title, description: description.replace(/[<>]/g, "").slice(0, 5000), tags };
}
