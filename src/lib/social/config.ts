import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { storageDir } from "@/lib/video/bin";

/**
 * Credenciais das integrações oficiais (OAuth) das redes.
 * Ordem: variáveis de ambiente (site/servidor) > storage/integrations.json (app desktop, gravado pela tela
 * de Redes Sociais). No desktop o Google exige cliente OAuth do tipo "App para computador", que aceita
 * redirect em http://127.0.0.1:<qualquer porta>.
 */
export interface YoutubeConfig {
  clientId: string;
  clientSecret: string;
}

interface IntegrationsFile {
  youtube?: Partial<YoutubeConfig>;
  uploadpost?: { apiKey?: string };
}

function file() {
  return path.join(storageDir(), "integrations.json");
}

function readFile(): IntegrationsFile {
  try {
    return JSON.parse(fs.readFileSync(file(), "utf8")) as IntegrationsFile;
  } catch {
    return {};
  }
}

export function youtubeConfig(): YoutubeConfig | null {
  const f = readFile().youtube ?? {};
  const clientId = process.env.YOUTUBE_CLIENT_ID || f.clientId || "";
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || f.clientSecret || "";
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function youtubeConfigFromEnv() {
  return !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET);
}

export function saveYoutubeConfig(cfg: YoutubeConfig | null) {
  const atual = readFile();
  if (cfg) atual.youtube = cfg;
  else delete atual.youtube;
  fs.writeFileSync(file(), JSON.stringify(atual, null, 2), "utf8");
}

/** Upload-Post (TikTok/Instagram sem app próprio nas redes): UPLOADPOST_API_KEY ou integrations.json. */
export function uploadPostKey(): string | null {
  return process.env.UPLOADPOST_API_KEY || readFile().uploadpost?.apiKey || null;
}

export function uploadPostKeyFromEnv() {
  return !!process.env.UPLOADPOST_API_KEY;
}

export function saveUploadPostKey(apiKey: string | null) {
  const atual = readFile();
  if (apiKey) atual.uploadpost = { apiKey };
  else delete atual.uploadpost;
  fs.writeFileSync(file(), JSON.stringify(atual, null, 2), "utf8");
}

export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * O login do Google abre no navegador do sistema (o Google bloqueia login dentro do Electron), onde não
 * existe o cookie de sessão do Cortix. Então o `state` leva o id do usuário assinado com HMAC e com validade.
 */
function hmac(data: string) {
  return crypto.createHmac("sha256", process.env.JWT_SECRET || "dev-secret").update(data).digest("base64url");
}

export function signState(userId: string, ttlMs = 15 * 60_000) {
  const body = Buffer.from(JSON.stringify({ u: userId, e: Date.now() + ttlMs, n: crypto.randomBytes(8).toString("hex") })).toString("base64url");
  return `${body}.${hmac(body)}`;
}

export function verifyState(state: string | null): string | null {
  if (!state) return null;
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const esperado = hmac(body);
  if (sig.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado))) return null;
  try {
    const { u, e } = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { u: string; e: number };
    return e > Date.now() ? u : null;
  } catch {
    return null;
  }
}
