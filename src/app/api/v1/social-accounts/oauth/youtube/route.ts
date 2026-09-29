import { db } from "@/lib/db";
import { fail, ok, withUser } from "@/lib/api";
import { isSubscriber } from "@/lib/auth";
import { getPlan } from "@/lib/plans";
import { signState } from "@/lib/social/config";
import { youtubeAuthUrl } from "@/lib/social/youtube";

/** Devolve a URL do login do Google. O front abre em nova janela (no desktop vai pro navegador do sistema). */
export const GET = withUser(async ({ req, user }) => {
  if (!isSubscriber(user!)) return fail("Conectar redes para publicação é exclusivo dos assinantes.", 403);
  const reconnect = new URL(req.url).searchParams.get("reconnect");
  if (!reconnect) {
    const plan = getPlan(user!.plan);
    const limit = plan?.socials ?? 0;
    const count = await db.socialAccount.count({ where: { userId: user!.id, purpose: "publish" } });
    if (count >= limit) return fail(`Seu plano ${plan?.name ?? ""} permite até ${limit} ${limit === 1 ? "conta conectada" : "contas conectadas"}.`, 403);
  }
  return ok({ url: youtubeAuthUrl(signState(user!.id)) });
});
