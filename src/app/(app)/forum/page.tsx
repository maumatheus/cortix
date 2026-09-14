"use client";

import { useState } from "react";
import { MessageCircle, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { api, useFetch, useUser } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/progress";
import { Page } from "@/components/page-header";
import { ALL_CATEGORIES, CategoryPills } from "@/components/forum/category-pills";
import { NewPostDialog } from "@/components/forum/new-post-dialog";
import { PostCard } from "@/components/forum/post-card";
import { initialOf, type ForumPost, type ForumPostsResponse } from "@/components/forum/types";

type Sort = "recent" | "top";

export default function ForumPage() {
  const { user } = useUser();
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [sort, setSort] = useState<Sort>("recent");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [quick, setQuick] = useState("");
  const [posting, setPosting] = useState(false);

  const url = `/api/v1/forum/posts?category=${category === ALL_CATEGORIES ? "" : category}&sort=${sort}&page=${page}`;
  const { data, loading, reload, setData } = useFetch<ForumPostsResponse>(url);
  const posts = data?.data || [];
  const composerCategory = category === ALL_CATEGORIES ? "geral" : category;

  function changeCategory(c: string) {
    setCategory(c);
    setPage(1);
  }
  function changeSort(s: Sort) {
    setSort(s);
    setPage(1);
  }

  function onCreated(post: ForumPost) {
    const visible = page === 1 && sort === "recent" && (category === ALL_CATEGORIES || category === post.category);
    if (visible) setData((prev) => (prev ? { ...prev, data: [post, ...prev.data], total: prev.total + 1 } : prev));
    else reload();
  }

  function onDeleted(id: string) {
    setData((prev) => (prev ? { ...prev, data: prev.data.filter((p) => p.id !== id), total: Math.max(0, prev.total - 1) } : prev));
  }

  async function quickPost() {
    const content = quick.trim();
    if (content.length < 3) return toast.error("Escreva pelo menos 3 caracteres");
    setPosting(true);
    try {
      const res = await api<{ post: ForumPost }>("/api/v1/forum/posts", { method: "POST", json: { content, category: composerCategory } });
      setQuick("");
      toast.success("Publicado!");
      onCreated(res.post);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPosting(false);
    }
  }

  return (
    <Page>
      <div className="grid gap-6 rounded-3xl border bg-card p-6 md:grid-cols-[1fr_auto] md:items-end md:p-8">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-success" /> Fórum · Sinal aberto
          </p>
          <h1 className="display mt-3 text-4xl md:text-5xl">Troca de creator pra creator.</h1>
          <p className="mt-4 max-w-2xl text-sm text-muted-foreground md:text-base">Troque estratégias, tire dúvidas e compartilhe aprendizados com quem também vive de criar conteúdo.</p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <Button size="lg" onClick={() => setOpen(true)}>
            <Plus /> Nova publicação
          </Button>
          <p className="text-xs text-muted-foreground">
            Participando como <span className="font-semibold text-foreground">{user?.name || "…"}</span>
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-2xl border bg-card px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">{initialOf(user?.name)}</span>
        <input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              quickPost();
            }
          }}
          placeholder="Compartilhe uma dúvida, dica ou ideia..."
          maxLength={5000}
          className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
        <Button size="icon" onClick={quickPost} loading={posting} title="Publicar" aria-label="Publicar">
          {!posting ? <Send /> : null}
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <CategoryPills value={category} onChange={changeCategory} />
        <div className="flex items-center gap-1 rounded-lg border bg-card p-0.5 text-xs">
          {(["recent", "top"] as Sort[]).map((s) => (
            <button
              key={s}
              onClick={() => changeSort(s)}
              className={cn("h-7 rounded-md px-3 font-semibold transition cursor-pointer", sort === s ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {s === "recent" ? "Recentes" : "Em alta"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {loading && !data ? (
          <>
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </>
        ) : posts.length === 0 ? (
          <EmptyState
            icon={<MessageCircle />}
            title="Nenhuma publicação por aqui ainda"
            description={category === ALL_CATEGORIES ? "Seja a primeira pessoa a compartilhar uma dúvida, dica ou ideia com a comunidade." : "Ainda não há publicações nesta categoria. Que tal abrir a conversa?"}
            action={
              <Button onClick={() => setOpen(true)}>
                <Plus /> Nova publicação
              </Button>
            }
          />
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} onDeleted={onDeleted} />)
        )}
      </div>

      {data && data.lastPage > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="font-mono">
            {page} / {data.lastPage}
          </span>
          <Button variant="outline" size="sm" disabled={page >= data.lastPage} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </Button>
        </div>
      ) : null}

      <NewPostDialog open={open} onOpenChange={setOpen} defaultCategory={composerCategory} onCreated={onCreated} />
    </Page>
  );
}
