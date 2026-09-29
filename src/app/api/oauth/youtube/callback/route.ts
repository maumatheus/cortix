import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { verifyState } from "@/lib/social/config";
import { exchangeYoutubeCode, youtubeChannel } from "@/lib/social/youtube";

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
  const esc = msg.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cortix · YouTube</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b10;color:#eee;font-family:system-ui,sans-serif}
.c{max-width:420px;padding:32px;border:1px solid #2a2a35;border-radius:16px;background:#14141c;text-align:center}
h1{font-size:20px;margin:12px 0 8px}p{color:#aaa;font-size:14px;line-height:1.5}.i{font-size:40px}</style></head>
<body><div class="c"><div class="i">${okay ? "✅" : "⚠️"}</div><h1>${okay ? "YouTube conectado" : "Não deu pra conectar"}</h1><p>${esc}</p></div>
${okay ? "<script>setTimeout(()=>{try{window.close()}catch(e){}},4000)</script>" : ""}</body></html>`;
  return new Response(html, { status: okay ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
