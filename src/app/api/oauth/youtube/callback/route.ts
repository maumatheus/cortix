import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { verifyState } from "@/lib/social/config";
import { exchangeYoutubeCode, youtubeChannel } from "@/lib/social/youtube";
import { oauthResultPage } from "@/lib/social/oauth-page";

/**
 * Retorno do login do Google. Roda no navegador do sistema (sem cookie do Cortix): o usuário vem no `state`
 * assinado. Se o canal já estava conectado (inclusive como simulado, pelo mesmo @), só atualiza os tokens.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const userId = verifyState(u.searchParams.get("state"));
  if (u.searchParams.get("error")) return page(false, "Você cancelou a autorização no Google.");
  if (!userId) return page(false, "Link de autorização expirado ou inválido. Volte ao Cortix e clique em conectar de novo.");
  const code = u.searchParams.get("code");
  if (!code) return page(false, "O Google não devolveu o código de autorização.");

  try {
    const t = await exchangeYoutubeCode(code);
    const ch = await youtubeChannel(t.access_token);
    const tokens = {
      connection: "oauth",
      externalId: ch.id,
      accessToken: t.access_token,
      tokenExpiresAt: new Date(Date.now() + t.expires_in * 1000),
      ...(t.refresh_token ? { refreshToken: t.refresh_token } : {}),
    };
    const existente = await db.socialAccount.findFirst({
      where: { userId, platform: "youtube", purpose: "publish", OR: [{ externalId: ch.id }, { handle: ch.handle }] },
    });
    if (existente) {
      await db.socialAccount.update({ where: { id: existente.id }, data: { ...tokens, handle: ch.handle } });
    } else {
      if (!t.refresh_token) return page(false, "O Google não liberou acesso permanente. Tente conectar de novo.");
      await db.socialAccount.create({ data: { id: newId(), userId, platform: "youtube", handle: ch.handle, purpose: "publish", ...tokens } });
    }
    return page(true, `Canal ${ch.handle} conectado. Pode fechar esta aba e voltar ao Cortix.`);
  } catch (e) {
    console.error("[oauth youtube]", e);
    return page(false, (e as Error).message);
  }
}

function page(okay: boolean, msg: string) {
  return oauthResultPage("YouTube", okay, msg);
}
