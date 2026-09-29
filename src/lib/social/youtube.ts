import fs from "node:fs";
import { db } from "@/lib/db";
import { appUrl, youtubeConfig } from "./config";

/** Integração oficial com o YouTube Data API v3: OAuth 2.0 + upload resumível de Shorts. */

const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];

export const YOUTUBE_CALLBACK_PATH = "/api/oauth/youtube/callback";

export function youtubeRedirectUri() {
  return appUrl() + YOUTUBE_CALLBACK_PATH;
}

function requireConfig() {
  const cfg = youtubeConfig();
  if (!cfg) throw Object.assign(new Error("Integração com o YouTube não configurada (Client ID / Client Secret do Google)."), { status: 400 });
  return cfg;
}

export function youtubeAuthUrl(state: string) {
  const cfg = requireConfig();
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: youtubeRedirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    // sempre pedir consentimento: sem isso o Google não devolve refresh_token numa segunda conexão
    prompt: "consent select_account",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const cfg = requireConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...params }),
  });
  const j = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !j.access_token) throw new Error(`Google recusou o token: ${j.error_description || j.error || res.status}`);
  return j;
}

export function exchangeYoutubeCode(code: string) {
  return tokenRequest({ code, grant_type: "authorization_code", redirect_uri: youtubeRedirectUri() });
}

export async function youtubeChannel(accessToken: string) {
  const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${accessToken}` } });
  const j = (await res.json().catch(() => ({}))) as { items?: Array<{ id: string; snippet: { title: string; customUrl?: string } }>; error?: { message: string } };
  if (!res.ok) throw new Error(`Não consegui ler o canal: ${j.error?.message || res.status}`);
  const ch = j.items?.[0];
  if (!ch) throw new Error("Essa conta Google não tem canal no YouTube. Crie o canal e conecte de novo.");
  return { id: ch.id, handle: ch.snippet.customUrl ? (ch.snippet.customUrl.startsWith("@") ? ch.snippet.customUrl : `@${ch.snippet.customUrl}`) : ch.snippet.title };
}

/** Access token válido da conta, renovando pelo refresh_token quando faltar menos de 2 min. */
export async function youtubeAccessToken(accountId: string) {
  const acc = await db.socialAccount.findUnique({ where: { id: accountId }, omit: { accessToken: false, refreshToken: false } });
  if (!acc?.accessToken) throw new Error("Conta sem autorização do Google. Reconecte a conta.");
  if (acc.tokenExpiresAt && acc.tokenExpiresAt.getTime() - Date.now() > 120_000) return acc.accessToken;
  if (!acc.refreshToken) throw new Error("Autorização do Google expirou. Reconecte a conta.");
  const t = await tokenRequest({ refresh_token: acc.refreshToken, grant_type: "refresh_token" });
  await db.socialAccount.update({
    where: { id: acc.id },
    data: { accessToken: t.access_token, tokenExpiresAt: new Date(Date.now() + t.expires_in * 1000), ...(t.refresh_token ? { refreshToken: t.refresh_token } : {}) },
  });
  return t.access_token;
}

export interface YoutubeUploadInput {
  filePath: string;
  title: string;
  description: string;
  tags?: string[];
  privacy?: "public" | "unlisted" | "private";
}

/** Upload resumível (videos.insert). Devolve o id do vídeo. */
export async function uploadYoutubeVideo(accessToken: string, input: YoutubeUploadInput) {
  const size = fs.statSync(input.filePath).size;
  const meta = {
    snippet: { title: input.title, description: input.description, tags: input.tags ?? [], categoryId: "22" },
    status: { privacyStatus: input.privacy ?? "public", selfDeclaredMadeForKids: false, embeddable: true },
  };
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(size),
    },
    body: JSON.stringify(meta),
  });
  const sessionUrl = init.headers.get("location");
  if (!init.ok || !sessionUrl) throw new Error(`YouTube recusou o envio: ${await apiError(init)}`);

  const up = await fetch(sessionUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Length": String(size) },
    body: fs.readFileSync(input.filePath),
  });
  if (!up.ok) throw new Error(`Falha no upload pro YouTube: ${await apiError(up)}`);
  const j = (await up.json()) as { id: string };
  return { id: j.id, url: `https://youtube.com/shorts/${j.id}` };
}

async function apiError(res: Response) {
  const j = (await res.json().catch(() => null)) as { error?: { message?: string; errors?: Array<{ reason?: string }> } } | null;
  const reason = j?.error?.errors?.[0]?.reason;
  if (reason === "quotaExceeded") return "cota diária da API do YouTube estourada (cada upload custa 1.600 de 10.000 unidades/dia). Tenta amanhã.";
  if (reason === "uploadLimitExceeded") return "o canal atingiu o limite de uploads do dia.";
  return j?.error?.message || `HTTP ${res.status}`;
}
