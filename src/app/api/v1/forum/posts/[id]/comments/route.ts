import { z } from "zod";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { fail, ok, readJson, withUser } from "@/lib/api";
import { STAFF_EMAIL } from "@/lib/forum";

const schema = z.object({
  content: z.string().trim().min(1, "Escreva um comentário").max(2000, "Comentário muito longo"),
});

type CommentRow = { id: string; content: string; createdAt: Date; user: { id: string; name: string; email: string } };

function serialize(c: CommentRow, currentUserId: string) {
  return {
    id: c.id,
    content: c.content,
    createdAt: c.createdAt,
    author: { id: c.user.id, name: c.user.name, staff: c.user.email === STAFF_EMAIL },
    mine: c.user.id === currentUserId,
  };
}

const include = { user: { select: { id: true, name: true, email: true } } };

export const GET = withUser(async ({ params, user }) => {
  const post = await db.forumPost.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!post) return fail("Publicação não encontrada", 404);
  const comments = await db.forumComment.findMany({ where: { postId: post.id }, orderBy: { createdAt: "asc" }, include });
  return ok({ data: comments.map((c) => serialize(c, user!.id)) });
});

export const POST = withUser(async ({ req, params, user }) => {
  const body = schema.parse(await readJson(req));
  const post = await db.forumPost.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!post) return fail("Publicação não encontrada", 404);
  const created = await db.forumComment.create({
    data: { id: newId(), postId: post.id, userId: user!.id, content: body.content },
    include,
  });
  return ok({ comment: serialize(created, user!.id) }, { status: 201 });
});
