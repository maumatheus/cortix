import fs from "node:fs";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { uploadPostKey } from "./config";

/**
 * Upload-Post (upload-post.com): publica no TikTok e no Instagram sem o Cortix precisar de app aprovado
 * em cada rede. Cada usuário do Cortix vira um "perfil" lá; as contas das redes são conectadas na página
 * deles (link com JWT) e o Cortix só sincroniza a lista. Plano grátis: 10 envios/mês.
 */

const API = process.env.UPLOADPOST_API_URL || "https://api.upload-post.com/api"; // env só pra testes
export const UPLOADPOST_PLATFORMS = ["tiktok", "instagram"] as const;

function key() {
  const k = uploadPostKey();
  if (!k) throw Object.assign(new Error("Integração com o Upload-Post não configurada (API key)."), { status: 400 });
  return k;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Apikey ${key()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = (await res.json().catch(() => ({}))) as T & { message?: string; error?: string };
  if (!res.ok) throw Object.assign(new Error(`Upload-Post: ${j.message || j.error || `HTTP ${res.status}`}`), { status: res.status === 401 ? 400 : 502 });
  return j;
}

/** Nome do perfil no Upload-Post pra este usuário do Cortix. */
export function profileName(userId: string) {
  return `cortix-${userId.toLowerCase()}`;
}

async function ensureProfile(userId: string) {
  const username = profileName(userId);
  try {
    await call("GET", `/uploadposts/users/${encodeURIComponent(username)}`);
  } catch {
    await call("POST", "/uploadposts/users", { username });
  }
  return username;
}

/** Link (válido ~48h) da página do Upload-Post onde o usuário conecta TikTok/Instagram. */
export async function uploadPostConnectUrl(userId: string) {
  const username = await ensureProfile(userId);
  const j = await call<{ access_url: string }>("POST", "/uploadposts/users/generate-jwt", {
    username,
    platforms: [...UPLOADPOST_PLATFORMS],
    connect_title: "Conectar contas ao Cortix",
    connect_description: "Conecte o TikTok e/ou o Instagram que vão receber seus cortes. Depois é só voltar ao Cortix.",
  });
  return j.access_url;
}

interface SocialAccountInfo {
  handle?: string;
  username?: string;
  display_name?: string;
  reauth_required?: boolean;
}

/** Lê as contas conectadas no perfil e espelha como SocialAccount (connection = "uploadpost"). */
export async function syncUploadPostAccounts(userId: string) {
  const username = profileName(userId);
  const j = await call<{ profile?: { social_accounts?: Record<string, SocialAccountInfo | string | null> } }>("GET", `/uploadposts/users/${encodeURIComponent(username)}`).catch(() => null);
  const accounts = j?.profile?.social_accounts ?? {};
  const found: Array<{ platform: string; handle: string; reauth: boolean }> = [];
  for (const platform of UPLOADPOST_PLATFORMS) {
    const a = accounts[platform];
    if (!a || typeof a !== "object") continue;
    const raw = a.handle || a.username || a.display_name;
    if (!raw) continue;
    found.push({ platform, handle: raw.startsWith("@") ? raw : `@${raw}`, reauth: !!a.reauth_required });
  }
  for (const f of found) {
    const existente = await db.socialAccount.findFirst({ where: { userId, platform: f.platform, purpose: "publish", OR: [{ connection: "uploadpost" }, { handle: f.handle }] } });
    if (existente) await db.socialAccount.update({ where: { id: existente.id }, data: { handle: f.handle, connection: "uploadpost", externalId: username } });
    else await db.socialAccount.create({ data: { id: newId(), userId, platform: f.platform, handle: f.handle, purpose: "publish", connection: "uploadpost", externalId: username } });
  }
  // conta desconectada lá volta a ser simulada aqui (não some: pode ter posts agendados)
  const ativos = new Set(found.map((f) => f.platform));
  await db.socialAccount.updateMany({ where: { userId, connection: "uploadpost", platform: { notIn: [...ativos] } }, data: { connection: "simulated" } });
  return found;
}

/** Dispara o envio (assíncrono lá). Devolve o request_id pra acompanhar em uploadPostStatus. */
export async function startUploadPost(input: { profile: string; platform: string; filePath: string; caption: string; title: string }) {
  const form = new FormData();
  form.append("user", input.profile);
  form.append("platform[]", input.platform);
  form.append("video", await fs.openAsBlob(input.filePath, { type: "video/mp4" }), "corte.mp4");
  // TikTok e Instagram usam o "title" como legenda do post
  form.append("title", input.caption.slice(0, 2200) || input.title);
  form.append("async_upload", "true");
  if (input.platform === "tiktok") {
    form.append("privacy_level", "PUBLIC_TO_EVERYONE");
    form.append("post_mode", "DIRECT_POST");
  }
  if (input.platform === "instagram") form.append("media_type", "REELS");
  const res = await fetch(`${API}/upload`, { method: "POST", headers: { Authorization: `Apikey ${key()}` }, body: form });
  const j = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    request_id?: string;
    message?: string;
    results?: Record<string, { success: boolean; url?: string; post_id?: string; error?: string; message?: string }>;
  };
  if (res.status === 429) throw new Error("Limite mensal de envios do Upload-Post atingido (plano grátis: 10/mês).");
  if (!res.ok || j.success === false) throw new Error(`Upload-Post recusou o envio: ${j.message || `HTTP ${res.status}`}`);
  // envio curto pode voltar síncrono, já com o resultado
  const r = j.results?.[input.platform];
  if (r) {
    if (!r.success) throw new Error(`Upload-Post: ${r.error || r.message || "falhou na rede"}`);
    return { done: true as const, id: r.post_id ?? null, url: r.url ?? null };
  }
  if (!j.request_id) throw new Error("Upload-Post não devolveu o id do envio");
  return { done: false as const, requestId: j.request_id };
}

export async function uploadPostStatus(requestId: string, platform: string) {
  const j = await call<{ status: "pending" | "in_progress" | "completed"; results?: Array<{ platform: string; success: boolean; message?: string; url?: string; post_id?: string }> }>(
    "GET",
    `/uploadposts/status?request_id=${encodeURIComponent(requestId)}`,
  );
  if (j.status !== "completed") return { state: "pending" as const };
  const r = j.results?.find((x) => x.platform === platform) ?? j.results?.[0];
  if (!r?.success) return { state: "failed" as const, error: `Upload-Post: ${r?.message || "a rede recusou o vídeo"}` };
  return { state: "done" as const, id: r.post_id ?? null, url: r.url ?? null };
}
