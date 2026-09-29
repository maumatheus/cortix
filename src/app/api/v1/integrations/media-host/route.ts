import { z } from "zod";
import { ok, readJson, withUser } from "@/lib/api";
import { mediaHostConfig, saveMediaHostConfig } from "@/lib/social/config";

const schema = z.object({
  url: z.string().trim().url("URL do Supabase inválida").regex(/^https:\/\//, "Use https"),
  serviceKey: z.string().trim().min(20, "Service key do Supabase inválida"),
  bucket: z.string().trim().regex(/^[a-z0-9-]{3,63}$/, "Nome de bucket: minúsculas, números e hífen").default("cortix-midia"),
});

/** Hospedagem temporária de imagens (capa/carrossel do Instagram). A service key nunca volta pro front. */
export const GET = withUser(async () => {
  const cfg = mediaHostConfig();
  return ok({ configured: !!cfg, url: cfg?.url ?? null, bucket: cfg?.bucket ?? null });
});

export const PUT = withUser(async ({ req }) => {
  saveMediaHostConfig(schema.parse(await readJson(req)));
  return ok({ ok: true });
});

export const DELETE = withUser(async () => {
  saveMediaHostConfig(null);
  return ok({ ok: true });
});
