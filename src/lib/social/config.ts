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
  youtube?: Partial<YoutubeConfig> & { audited?: boolean };
  uploadpost?: { apiKey?: string };
  meta?: Partial<MetaConfig>;
}

/** App Business próprio da Meta (Instagram + Facebook pela Graph API). configId: Facebook Login for Business (opcional). */
export interface MetaConfig {
  appId: string;
  appSecret: string;
  configId?: string;
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
  if (cfg) atual.youtube = { ...cfg, audited: atual.youtube?.audited };
  else delete atual.youtube;
  writeFile(atual);
}

/**
 * App do Google já passou na auditoria da API do YouTube? Sem ela o YouTube trava todo upload como privado,
 * então o Cortix sobe privado de propósito e avisa pra publicar na mão no YouTube Studio.
 */
export function youtubeAudited() {
  return process.env.YOUTUBE_AUDITED === "1" || readFile().youtube?.audited === true;
}

export function saveYoutubeAudited(audited: boolean) {
  const atual = readFile();
  atual.youtube = { ...atual.youtube, audited };
  writeFile(atual);
}

export function metaConfig(): MetaConfig | null {
  const f = readFile().meta ?? {};
  const appId = process.env.META_APP_ID || f.appId || "";
  const appSecret = process.env.META_APP_SECRET || f.appSecret || "";
  const configId = process.env.META_CONFIG_ID || f.configId || undefined;
  return appId && appSecret ? { appId, appSecret, configId } : null;
}

export function metaConfigFromEnv() {
  return !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export function saveMetaConfig(cfg: MetaConfig | null) {
  const atual = readFile();
  if (cfg) atual.meta = cfg;
  else delete atual.meta;
  writeFile(atual);
}

function writeFile(data: IntegrationsFile) {
  fs.writeFileSync(file(), JSON.stringify(data, null, 2), "utf8");
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
  writeFile(atual);
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
