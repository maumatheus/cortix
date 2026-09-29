import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { getPlan } from "@/lib/plans";
import { appUrl, metaConfig } from "./config";

/**
 * Instagram + Facebook direto pela Graph API da Meta, com o app Business próprio do dono do Cortix.
 * Em modo desenvolvimento o admin do app publica nas Páginas/IGs dele sem App Review.
 * - Facebook: 1 SocialAccount por Página (externalId = id da Página, token = token da Página, que não expira).
 * - Instagram: 1 SocialAccount por conta profissional ligada a uma Página (externalId = id do IG, token = token da Página).
 * Reels sobem por upload resumível (arquivo local, sem precisar de URL pública). Imagens de carrossel sobem como
 * foto não publicada na Página e o IG busca pela URL do CDN da Meta.
 */

const VERSION = process.env.META_GRAPH_VERSION || "v23.0";
// sobrescrevíveis só pro smoke test (API falsa)
const GRAPH = (process.env.META_GRAPH_URL || "https://graph.facebook.com").replace(/\/$/, "");
const RUPLOAD = (process.env.META_RUPLOAD_URL || "https://rupload.facebook.com").replace(/\/$/, "");

export const META_SCOPES = ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "instagram_basic", "instagram_content_publish", "business_management"];
export const META_CALLBACK_PATH = "/api/oauth/meta/callback";
/** Prefixo do externalId enquanto o container do Instagram processa. */
export const META_PENDING_PREFIX = "ig:";

/** A Meta só aceita redirect sem HTTPS em "localhost" (o app desktop roda em 127.0.0.1, que é o mesmo servidor). */
export function metaRedirectUri() {
  return appUrl().replace(/^http:\/\/127\.0\.0\.1(?=[:/]|$)/, "http://localhost") + META_CALLBACK_PATH;
}

function requireConfig() {
  const cfg = metaConfig();
  if (!cfg) throw Object.assign(new Error("Integração com a Meta não configurada (App ID / App Secret)."), { status: 400 });
  return cfg;
}

export function metaAuthUrl(state: string) {
  const cfg = requireConfig();
  const q = new URLSearchParams({ client_id: cfg.appId, redirect_uri: metaRedirectUri(), response_type: "code", state });
  // Facebook Login for Business usa uma configuração (config_id) no lugar da lista de escopos
  if (cfg.configId) q.set("config_id", cfg.configId);
  else q.set("scope", META_SCOPES.join(","));
  return `https://www.facebook.com/${VERSION}/dialog/oauth?${q}`;
}

class GraphError extends Error {}

/** Chamada à Graph API. O token vai no header (nunca na URL), então não aparece em log de erro. */
async function graph<T>(method: "GET" | "POST", route: string, token: string | null, params: Record<string, string> = {}, body?: FormData): Promise<T> {
  const url = new URL(`${GRAPH}/${VERSION}/${route.replace(/^\//, "")}`);
  let payload: BodyInit | undefined = body;
  if (method === "GET") for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  else if (!body) payload = new URLSearchParams(params);
  else for (const [k, v] of Object.entries(params)) body.append(k, v);
  const res = await fetch(url, { method, headers: token ? { Authorization: `Bearer ${token}` } : {}, body: payload });
  const j = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; code?: number; error_user_msg?: string } };
  if (!res.ok || j.error) throw new GraphError(graphMessage(j.error, res.status));
  return j;
}

function graphMessage(e: { message?: string; code?: number; error_user_msg?: string } | undefined, status: number) {
  if (e?.code === 190) return "Meta: autorização expirada ou revogada. Reconecte a conta em Redes Sociais.";
  if (e?.code === 10 || e?.code === 200) return `Meta: permissão faltando (${e.message}). Reconecte e aceite todas as permissões.`;
  if (e?.code === 4 || e?.code === 32 || e?.code === 613) return "Meta: limite de chamadas atingido. Tenta de novo mais tarde.";
  return `Meta: ${e?.error_user_msg || e?.message || `HTTP ${status}`}`;
}

/** code → token de usuário de longa duração (~60 dias). Os tokens de Página tirados dele não expiram. */
export async function exchangeMetaCode(code: string) {
  const cfg = requireConfig();
  const short = await graph<{ access_token: string }>("GET", "oauth/access_token", null, { client_id: cfg.appId, client_secret: cfg.appSecret, redirect_uri: metaRedirectUri(), code });
  const long = await graph<{ access_token: string }>("GET", "oauth/access_token", null, { grant_type: "fb_exchange_token", client_id: cfg.appId, client_secret: cfg.appSecret, fb_exchange_token: short.access_token });
  return long.access_token;
}

interface MetaPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
}

/**
 * Espelha as Páginas e IGs que o usuário autorizou como SocialAccount (connection = "meta").
 * Respeita o limite de contas do plano: o que passar do limite fica de fora e volta em `skipped`.
 */
export async function connectMetaAccounts(userId: string, userToken: string) {
  const pages: MetaPage[] = [];
  let after: string | undefined;
  do {
    const j = await graph<{ data: MetaPage[]; paging?: { cursors?: { after?: string }; next?: string } }>("GET", "me/accounts", userToken, { fields: "id,name,access_token,instagram_business_account{id,username}", limit: "50", ...(after ? { after } : {}) });
    pages.push(...j.data);
    after = j.paging?.next ? j.paging.cursors?.after : undefined;
  } while (after);
  if (!pages.length) throw new Error("Nenhuma Página do Facebook foi autorizada. Conecte de novo e marque as Páginas (e os IGs ligados a elas).");

  const user = await db.user.findUnique({ where: { id: userId }, select: { plan: true } });
  const limit = getPlan(user?.plan ?? "")?.socials ?? 0;
  let count = await db.socialAccount.count({ where: { userId, purpose: "publish" } });
  const connected: string[] = [];
  const skipped: string[] = [];

  const upsert = async (platform: "facebook" | "instagram", externalId: string, handle: string, token: string) => {
    const existente = await db.socialAccount.findFirst({ where: { userId, platform, purpose: "publish", OR: [{ externalId }, { handle }] } });
    const data = { connection: "meta", externalId, handle, accessToken: token, refreshToken: null, tokenExpiresAt: null };
    if (existente) await db.socialAccount.update({ where: { id: existente.id }, data });
    else if (count >= limit) return void skipped.push(`${platform}:${handle}`);
    else {
      await db.socialAccount.create({ data: { id: newId(), userId, platform, purpose: "publish", ...data } });
      count++;
    }
    connected.push(`${platform}:${handle}`);
  };
  for (const p of pages) {
    await upsert("facebook", p.id, p.name, p.access_token);
    const ig = p.instagram_business_account;
    if (ig) await upsert("instagram", ig.id, ig.username ? `@${ig.username}` : p.name, p.access_token);
  }
  return { connected, skipped };
}

interface MetaAccount {
  platform: string;
  externalId: string | null;
  accessToken: string | null;
}

async function accountToken(accountId: string) {
  const acc = await db.socialAccount.findUnique({ where: { id: accountId }, omit: { accessToken: false } });
  if (!acc?.accessToken || !acc.externalId) throw new Error("Conta sem autorização da Meta. Reconecte a conta em Redes Sociais.");
  return { platform: acc.platform, externalId: acc.externalId, accessToken: acc.accessToken } satisfies MetaAccount;
}

/** Id da Página dona do token (o token do IG é o token da Página ligada a ele). */
async function pageIdOf(token: string) {
  return (await graph<{ id: string }>("GET", "me", token, { fields: "id" })).id;
}

/** Foto não publicada na Página: serve de hospedagem pro carrossel (IG) ou de anexo do post (FB). */
async function uploadUnpublishedPhoto(pageId: string, token: string, imagePath: string) {
  const form = new FormData();
  const type = /\.png$/i.test(imagePath) ? "image/png" : "image/jpeg";
  form.append("source", new Blob([fs.readFileSync(imagePath)], { type }), path.basename(imagePath));
  return (await graph<{ id: string }>("POST", `${pageId}/photos`, token, { published: "false" }, form)).id;
}

async function photoUrl(photoId: string, token: string) {
  const j = await graph<{ images?: Array<{ source: string; width: number }> }>("GET", photoId, token, { fields: "images" });
  const best = j.images?.sort((a, b) => b.width - a.width)[0];
  if (!best) throw new Error("Meta: não consegui a URL da imagem enviada.");
  return best.source;
}

async function uploadBinary(url: string, token: string, filePath: string) {
  const size = fs.statSync(filePath).size;
  const res = await fetch(url, { method: "POST", headers: { Authorization: `OAuth ${token}`, offset: "0", file_size: String(size) }, body: fs.readFileSync(filePath) });
  const j = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string; code?: number } };
  if (!res.ok || j.error || j.success === false) throw new GraphError(graphMessage(j.error, res.status));
}

export type MetaResult = { id: string | null; url: string | null } | { requestId: string };

/** Reel (vídeo vertical local) no Instagram ou no Facebook. */
export async function publishMetaVideo(accountId: string, input: { filePath: string; caption: string }): Promise<MetaResult> {
  const acc = await accountToken(accountId);
  if (acc.platform === "instagram") {
    const c = await graph<{ id: string; uri?: string }>("POST", `${acc.externalId}/media`, acc.accessToken, { media_type: "REELS", upload_type: "resumable", caption: input.caption, share_to_feed: "true" });
    await uploadBinary(c.uri || `${RUPLOAD}/ig-api-upload/${VERSION}/${c.id}`, acc.accessToken, input.filePath);
    return { requestId: META_PENDING_PREFIX + c.id };
  }
  if (acc.platform === "facebook") {
    const page = acc.externalId;
    const st = await graph<{ video_id: string; upload_url?: string }>("POST", `${page}/video_reels`, acc.accessToken, { upload_phase: "start" });
    await uploadBinary(st.upload_url || `${RUPLOAD}/video-upload/${VERSION}/${st.video_id}`, acc.accessToken, input.filePath);
    await graph("POST", `${page}/video_reels`, acc.accessToken, { upload_phase: "finish", video_id: st.video_id, video_state: "PUBLISHED", description: input.caption });
    return { id: st.video_id, url: `https://www.facebook.com/reel/${st.video_id}` };
  }
  throw new Error(`Conta Meta de plataforma inesperada: ${acc.platform}`);
}

/** Carrossel (1 a 10 imagens): IG vira CAROUSEL (ou foto única), FB vira post com várias fotos. */
export async function publishMetaCarousel(accountId: string, input: { imagePaths: string[]; caption: string }): Promise<MetaResult> {
  const acc = await accountToken(accountId);
  const pageId = acc.platform === "facebook" ? acc.externalId : await pageIdOf(acc.accessToken);
  const photos: string[] = [];
  for (const img of input.imagePaths) photos.push(await uploadUnpublishedPhoto(pageId, acc.accessToken, img));

  if (acc.platform === "facebook") {
    const params: Record<string, string> = { message: input.caption };
    photos.forEach((id, i) => (params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })));
    const post = await graph<{ id: string }>("POST", `${pageId}/feed`, acc.accessToken, params);
    return { id: post.id, url: `https://www.facebook.com/${post.id}` };
  }

  const urls: string[] = [];
  for (const id of photos) urls.push(await photoUrl(id, acc.accessToken));
  if (urls.length === 1) {
    const c = await graph<{ id: string }>("POST", `${acc.externalId}/media`, acc.accessToken, { image_url: urls[0], caption: input.caption });
    return { requestId: META_PENDING_PREFIX + c.id };
  }
  const children: string[] = [];
  for (const u of urls) children.push((await graph<{ id: string }>("POST", `${acc.externalId}/media`, acc.accessToken, { image_url: u, is_carousel_item: "true" })).id);
  const c = await graph<{ id: string }>("POST", `${acc.externalId}/media`, acc.accessToken, { media_type: "CAROUSEL", children: children.join(","), caption: input.caption });
  return { requestId: META_PENDING_PREFIX + c.id };
}

/** Status do container do Instagram; quando termina de processar, publica e devolve o link. */
export async function metaPendingStatus(accountId: string, requestId: string): Promise<{ state: "done"; id: string; url: string | null } | { state: "failed"; error: string } | { state: "pending" }> {
  const acc = await accountToken(accountId);
  const container = requestId.startsWith(META_PENDING_PREFIX) ? requestId.slice(META_PENDING_PREFIX.length) : requestId;
  const st = await graph<{ status_code?: string; status?: string }>("GET", container, acc.accessToken, { fields: "status_code,status" });
  if (st.status_code === "ERROR" || st.status_code === "EXPIRED") return { state: "failed", error: `Instagram recusou a mídia: ${st.status || st.status_code}` };
  if (st.status_code !== "FINISHED") return { state: "pending" };
  const pub = await graph<{ id: string }>("POST", `${acc.externalId}/media_publish`, acc.accessToken, { creation_id: container });
  const link = await graph<{ permalink?: string }>("GET", pub.id, acc.accessToken, { fields: "permalink" }).catch(() => ({ permalink: undefined }));
  return { state: "done", id: pub.id, url: link.permalink ?? null };
}
