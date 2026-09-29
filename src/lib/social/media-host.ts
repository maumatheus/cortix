import fs from "node:fs";
import path from "node:path";
import { newId } from "@/lib/ids";
import { mediaHostConfig } from "./config";

/**
 * Hospedagem temporária de mídia pro Instagram buscar por URL (vídeo do Reel, capa, fotos de carrossel).
 * A API do Instagram com login do Instagram só aceita mídia por URL pública (o upload resumível não vale
 * em graph.instagram.com); sem Página do Facebook não há
 * CDN da Meta pra usar, então as imagens sobem num bucket público do Supabase e são apagadas depois
 * (o que tiver mais de HOST_TTL_H horas some na próxima hospedagem).
 */
const HOST_TTL_H = 12;

function requireHost() {
  const cfg = mediaHostConfig();
  if (!cfg) throw new Error("Hospedagem de mídia não configurada (Supabase: URL + service key em integrations.json › mediaHost). Necessária pro Instagram conectado pelo login do Instagram (sem Página).");
  return cfg;
}

export function mediaHostReady() {
  return !!mediaHostConfig();
}

async function storage(method: string, route: string, body?: BodyInit, contentType = "application/json") {
  const cfg = requireHost();
  const res = await fetch(`${cfg.url}/storage/v1/${route}`, {
    method,
    headers: { Authorization: `Bearer ${cfg.serviceKey}`, apikey: cfg.serviceKey, "Content-Type": contentType, "x-upsert": "true" },
    body,
  });
  const j = (await res.json().catch(() => ({}))) as { message?: string; error?: string; statusCode?: string };
  return { ok: res.ok, status: res.status, json: j };
}

async function ensureBucket() {
  const cfg = requireHost();
  const r = await storage("POST", "bucket", JSON.stringify({ id: cfg.bucket, name: cfg.bucket, public: true }));
  // 400/409 = já existe
  if (!r.ok && ![400, 409].includes(r.status)) throw new Error(`Hospedagem: não consegui criar o bucket (${r.json.message || r.status})`);
}

const TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".mp4": "video/mp4", ".mov": "video/quicktime" };

/** Sobe o arquivo e devolve a URL pública + o nome do objeto (pra apagar depois). */
export async function hostFile(filePath: string): Promise<{ url: string; name: string }> {
  const cfg = requireHost();
  await ensureBucket();
  await purgeHosted().catch(() => {});
  const ext = path.extname(filePath).toLowerCase() || ".jpg";
  const name = `${new Date().toISOString().slice(0, 10)}/${newId()}${ext}`;
  const type = TYPES[ext] ?? "application/octet-stream";
  const r = await storage("POST", `object/${cfg.bucket}/${name}`, fs.readFileSync(filePath), type);
  if (!r.ok) throw new Error(`Hospedagem: falha ao subir ${path.basename(filePath)} (${r.json.message || r.status})`);
  return { url: `${cfg.url}/storage/v1/object/public/${cfg.bucket}/${name}`, name };
}

export const hostImage = hostFile;

export async function deleteHosted(names: string[]) {
  if (!names.length) return;
  const cfg = requireHost();
  await storage("DELETE", `object/${cfg.bucket}`, JSON.stringify({ prefixes: names }));
}

/** Apaga o que foi hospedado há mais de HOST_TTL_H horas (o Instagram já buscou). */
export async function purgeHosted(olderThanMs = HOST_TTL_H * 3600_000) {
  const cfg = requireHost();
  const limite = Date.now() - olderThanMs;
  const velhos: string[] = [];
  const pastas = await storage("POST", `object/list/${cfg.bucket}`, JSON.stringify({ prefix: "", limit: 100 }));
  for (const p of (pastas.json as unknown as Array<{ name: string; id: string | null }>) ?? []) {
    if (p.id) continue; // só pastas por dia
    const itens = await storage("POST", `object/list/${cfg.bucket}`, JSON.stringify({ prefix: p.name, limit: 1000 }));
    for (const o of (itens.json as unknown as Array<{ name: string; created_at?: string }>) ?? []) {
      if (o.created_at && Date.parse(o.created_at) < limite) velhos.push(`${p.name}/${o.name}`);
    }
  }
  await deleteHosted(velhos);
  return velhos.length;
}
