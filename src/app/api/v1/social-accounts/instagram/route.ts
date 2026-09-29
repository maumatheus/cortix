import { z } from "zod";
import { ok, readJson, withUser } from "@/lib/api";
import { connectInstagramToken } from "@/lib/social/meta";

const schema = z.object({
  token: z.string().trim().regex(/^IG[A-Za-z0-9_-]{40,}$/, "Token do Instagram inválido (começa com IG e é longo)"),
  channel: z.string().trim().min(1).max(40).nullable().optional(),
});

/**
 * Conecta uma conta profissional do Instagram pelo token do painel da Meta (API do Instagram com login do
 * Instagram). O token é renovado na hora (60 dias) e o Cortix renova sozinho antes de expirar.
 */
export const POST = withUser(async ({ req, user }) => {
  const body = schema.parse(await readJson(req));
  return ok(await connectInstagramToken(user!.id, body.token, body.channel));
});
