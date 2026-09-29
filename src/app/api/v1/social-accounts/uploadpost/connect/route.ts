import { fail, ok, withUser } from "@/lib/api";
import { isSubscriber } from "@/lib/auth";
import { uploadPostConnectUrl } from "@/lib/social/uploadpost";

/** Link da página do Upload-Post onde o usuário conecta TikTok/Instagram (abre no navegador). */
export const GET = withUser(async ({ user }) => {
  if (!isSubscriber(user!)) return fail("Conectar redes para publicação é exclusivo dos assinantes.", 403);
  return ok({ url: await uploadPostConnectUrl(user!.id) });
});
