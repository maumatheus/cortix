import { verifyState } from "@/lib/social/config";
import { connectMetaAccounts, exchangeMetaCode } from "@/lib/social/meta";
import { oauthResultPage } from "@/lib/social/oauth-page";

/**
 * Retorno do login da Meta (Facebook). Roda no navegador do sistema (sem cookie do Cortix): o usuário vem no
 * `state` assinado. Conecta cada Página autorizada (Facebook) e o IG profissional ligado a ela (Instagram).
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const userId = verifyState(u.searchParams.get("state"));
  if (u.searchParams.get("error")) return oauthResultPage("Meta", false, "Você cancelou a autorização no Facebook.");
  if (!userId) return oauthResultPage("Meta", false, "Link de autorização expirado ou inválido. Volte ao Cortix e clique em conectar de novo.");
  const code = u.searchParams.get("code");
  if (!code) return oauthResultPage("Meta", false, "A Meta não devolveu o código de autorização.");
  try {
    const { connected, skipped } = await connectMetaAccounts(userId, await exchangeMetaCode(code));
    const nomes = connected.map((c) => c.replace(/^facebook:/, "Página ").replace(/^instagram:/, "IG ")).join(", ");
    const extra = skipped.length ? ` Ficaram de fora pelo limite do plano: ${skipped.join(", ")}.` : "";
    return oauthResultPage("Meta", connected.length > 0, connected.length ? `Conectado: ${nomes}.${extra} Pode fechar esta aba e voltar ao Cortix.` : `Nada foi conectado.${extra}`);
  } catch (e) {
    console.error("[oauth meta]", (e as Error).message);
    return oauthResultPage("Meta", false, (e as Error).message);
  }
}
