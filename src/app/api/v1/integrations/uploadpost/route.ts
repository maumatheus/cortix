import { z } from "zod";
import { fail, ok, readJson, withUser } from "@/lib/api";
import { saveUploadPostKey, uploadPostKey, uploadPostKeyFromEnv } from "@/lib/social/config";

const schema = z.object({ apiKey: z.string().trim().min(20, "API key do Upload-Post inválida") });

export const GET = withUser(async () => {
  const k = uploadPostKey();
  return ok({ configured: !!k, fromEnv: uploadPostKeyFromEnv(), hint: k ? `${k.slice(0, 4)}…${k.slice(-4)}` : null });
});

export const PUT = withUser(async ({ req }) => {
  const { apiKey } = schema.parse(await readJson(req));
  // valida a chave antes de salvar
  const res = await fetch("https://api.upload-post.com/api/uploadposts/users", { headers: { Authorization: `Apikey ${apiKey}` } });
  if (res.status === 401 || res.status === 403) return fail("O Upload-Post recusou essa API key.", 400);
  saveUploadPostKey(apiKey);
  return ok({ ok: true });
});

export const DELETE = withUser(async () => {
  saveUploadPostKey(null);
  return ok({ ok: true });
});
