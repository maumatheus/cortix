/** Constantes compartilhadas (servidor + cliente) da comunidade. */
export const FORUM_CATEGORIES = ["geral", "dicas", "tiktok", "instagram", "youtube", "ideias", "perguntas"] as const;
export type ForumCategory = (typeof FORUM_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ForumCategory, string> = {
  geral: "Geral",
  dicas: "Dicas",
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  ideias: "Ideias",
  perguntas: "Perguntas",
};

export const STAFF_EMAIL = "equipe@cortix.app";

export function isForumCategory(v: string): v is ForumCategory {
  return (FORUM_CATEGORIES as readonly string[]).includes(v);
}

export function categoryLabel(c: string): string {
  return isForumCategory(c) ? CATEGORY_LABELS[c] : c.charAt(0).toUpperCase() + c.slice(1);
}

/** Linha de publicação como vem do Prisma (com include de autor, contagem e voto do usuário). */
export type ForumPostRow = {
  id: string;
  category: string;
  title: string;
  content: string;
  upvotes: number;
  createdAt: Date;
  user: { id: string; name: string; email: string };
  _count: { comments: number };
  votes: { id: string }[];
};

/** Include padrão para carregar publicações com autor, contagem de comentários e voto do usuário atual. */
export const forumPostInclude = (userId: string) => ({
  user: { select: { id: true, name: true, email: true } },
  _count: { select: { comments: true } },
  votes: { where: { userId }, select: { id: true } },
});

export function serializeForumPost(p: ForumPostRow, currentUserId: string) {
  return {
    id: p.id,
    category: p.category,
    title: p.title,
    content: p.content,
    upvotes: p.upvotes,
    createdAt: p.createdAt,
    author: { id: p.user.id, name: p.user.name, staff: p.user.email === STAFF_EMAIL },
    commentsCount: p._count.comments,
    voted: p.votes.length > 0,
    mine: p.user.id === currentUserId,
  };
}

/** Deriva um título a partir da primeira linha do conteúdo. */
export function deriveTitle(content: string): string {
  const first = content
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean) || "Publicação";
  return first.length > 120 ? first.slice(0, 117).trimEnd() + "…" : first;
}
