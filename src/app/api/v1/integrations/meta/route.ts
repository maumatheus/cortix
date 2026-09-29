import { z } from "zod";
import { ok, readJson, withUser } from "@/lib/api";
import { metaConfig, metaConfigFromEnv, saveMetaConfig } from "@/lib/social/config";
import { META_SCOPES, metaRedirectUri } from "@/lib/social/meta";

const schema = z.object({
  appId: z.string().trim().regex(/^\d{8,20}$/, "O App ID da Meta é só número (ex.: 1234567890123456)"),
  appSecret: z.string().trim().regex(/^[0-9a-f]{32}$/i, "O App Secret da Meta tem 32 caracteres (0-9, a-f)"),
  configId: z.string().trim().regex(/^\d{8,20}$/, "O Configuration ID é só número").optional().or(z.literal("").transform(() => undefined)),
});

/** O secret nunca volta pro front: só se está configurado e o App ID. */
export const GET = withUser(async () => {
  const cfg = metaConfig();
  return ok({ configured: !!cfg, fromEnv: metaConfigFromEnv(), appId: cfg?.appId ?? null, configId: cfg?.configId ?? null, redirectUri: metaRedirectUri(), scopes: META_SCOPES });
});

export const PUT = withUser(async ({ req }) => {
  saveMetaConfig(schema.parse(await readJson(req)));
  return ok({ ok: true });
});

export const DELETE = withUser(async () => {
  saveMetaConfig(null);
  return ok({ ok: true });
});
