import { db } from "@/lib/db";
import { fail, ok, withUser } from "@/lib/api";

/** Exclui uma publicação — apenas o autor pode excluir. */
export const DELETE = withUser(async ({ params, user }) => {
  const post = await db.forumPost.findUnique({ where: { id: params.id }, select: { id: true, userId: true } });
  if (!post) return fail("Publicação não encontrada", 404);
  if (post.userId !== user!.id) return fail("Você só pode excluir as suas próprias publicações", 403);
  await db.forumPost.delete({ where: { id: post.id } });
  return ok({ ok: true });
});
