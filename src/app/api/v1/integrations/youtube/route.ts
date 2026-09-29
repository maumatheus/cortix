import { z } from "zod";
import { ok, readJson, withUser } from "@/lib/api";
import { saveYoutubeAudited, saveYoutubeConfig, youtubeAudited, youtubeConfig, youtubeConfigFromEnv } from "@/lib/social/config";
import { youtubeRedirectUri } from "@/lib/social/youtube";

const schema = z.object({
  clientId: z.string().trim().min(10, "Client ID inválido").regex(/\.apps\.googleusercontent\.com$/, "O Client ID do Google termina em .apps.googleusercontent.com"),
  clientSecret: z.string().trim().min(10, "Client Secret inválido"),
});

export const GET = withUser(async () => {
  const cfg = youtubeConfig();
  return ok({
    configured: !!cfg,
    fromEnv: youtubeConfigFromEnv(),
    clientId: cfg ? cfg.clientId.replace(/^(.{6}).*(.{4}\.apps\.googleusercontent\.com)$/, "$1…$2") : null,
    redirectUri: youtubeRedirectUri(),
    // sem auditoria os uploads saem privados (o Cortix avisa em cada post)
    audited: youtubeAudited(),
  });
});

export const PUT = withUser(async ({ req }) => {
  const body = schema.parse(await readJson(req));
  saveYoutubeConfig(body);
  return ok({ ok: true });
});

export const DELETE = withUser(async () => {
  saveYoutubeConfig(null);
  return ok({ ok: true });
});

/** Marca/desmarca "o app do Google já passou na auditoria da API do YouTube". */
export const PATCH = withUser(async ({ req }) => {
  const { audited } = z.object({ audited: z.boolean() }).parse(await readJson(req));
  saveYoutubeAudited(audited);
  return ok({ ok: true, audited });
});
