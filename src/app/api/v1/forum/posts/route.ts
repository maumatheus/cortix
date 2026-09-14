import { z } from "zod";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { ok, readJson, withUser } from "@/lib/api";
import { FORUM_CATEGORIES, deriveTitle, forumPostInclude, isForumCategory, serializeForumPost } from "@/lib/forum";

const PAGE_SIZE = 20;

const createSchema = z.object({
  title: z.string().trim().max(160, "Título muito longo").optional(),
  content: z.string().trim().min(3, "Escreva pelo menos 3 caracteres").max(5000, "Conteúdo muito longo"),
  category: z.enum(FORUM_CATEGORIES).default("geral"),
});

export const GET = withUser(async ({ req, user }) => {
  const u = new URL(req.url);
  const category = u.searchParams.get("category") || "";
  const sort = u.searchParams.get("sort") === "top" ? "top" : "recent";
  const page = Math.max(1, Number(u.searchParams.get("page")) || 1);

  const where = isForumCategory(category) ? { category } : {};
  const orderBy = sort === "top" ? [{ upvotes: "desc" as const }, { createdAt: "desc" as const }] : [{ createdAt: "desc" as const }];

  const [total, posts] = await Promise.all([
    db.forumPost.count({ where }),
    db.forumPost.findMany({ where, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: forumPostInclude(user!.id) }),
  ]);

  return ok({
    data: posts.map((p) => serializeForumPost(p, user!.id)),
    page,
    total,
    lastPage: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  });
});

export const POST = withUser(async ({ req, user }) => {
  const body = createSchema.parse(await readJson(req));
  const title = body.title && body.title.length > 0 ? body.title : deriveTitle(body.content);
  const created = await db.forumPost.create({
    data: { id: newId(), userId: user!.id, category: body.category, title, content: body.content },
    include: forumPostInclude(user!.id),
  });
  return ok({ post: serializeForumPost(created, user!.id) }, { status: 201 });
});
