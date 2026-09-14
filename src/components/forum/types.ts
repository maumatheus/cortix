export interface ForumAuthor {
  id: string;
  name: string;
  staff: boolean;
}

export interface ForumPost {
  id: string;
  category: string;
  title: string;
  content: string;
  upvotes: number;
  createdAt: string;
  author: ForumAuthor;
  commentsCount: number;
  voted: boolean;
  mine: boolean;
}

export interface ForumComment {
  id: string;
  content: string;
  createdAt: string;
  author: ForumAuthor;
  mine: boolean;
}

export interface ForumPostsResponse {
  data: ForumPost[];
  page: number;
  total: number;
  lastPage: number;
}

/** "5 minutos" → "há 5 minutos"; "agora"/"ontem"/"anteontem" ficam como estão. */
export function relativeTime(label: string): string {
  return ["agora", "ontem", "anteontem"].includes(label) ? label : `há ${label}`;
}

export function initialOf(name: string | undefined | null): string {
  return (name?.trim().charAt(0) || "C").toUpperCase();
}
