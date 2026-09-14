import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { fail, ok, withUser } from "@/lib/api";

/** Alterna o upvote do usuário na publicação, mantendo o contador `upvotes` sincronizado. */
export const POST = withUser(async ({ params, user }) => {
  const post = await db.forumPost.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!post) return fail("Publicação não encontrada", 404);

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.forumVote.findUnique({ where: { postId_userId: { postId: post.id, userId: user!.id } } });
    if (existing) {
      await tx.forumVote.delete({ where: { id: existing.id } });
      const updated = await tx.forumPost.update({ where: { id: post.id }, data: { upvotes: { decrement: 1 } }, select: { upvotes: true } });
      if (updated.upvotes < 0) await tx.forumPost.update({ where: { id: post.id }, data: { upvotes: 0 } });
      return { voted: false, upvotes: Math.max(0, updated.upvotes) };
    }
    await tx.forumVote.create({ data: { id: newId(), postId: post.id, userId: user!.id } });
    const updated = await tx.forumPost.update({ where: { id: post.id }, data: { upvotes: { increment: 1 } }, select: { upvotes: true } });
    return { voted: true, upvotes: updated.upvotes };
  });

  return ok(result);
});
