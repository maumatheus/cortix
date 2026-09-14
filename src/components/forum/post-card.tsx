"use client";

import { useEffect, useState } from "react";
import { ArrowBigUp, Bookmark, MessageCircle, Send, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, useFetch } from "@/lib/hooks";
import { cn, timeAgo } from "@/lib/utils";
import { categoryLabel } from "@/lib/forum";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/progress";
import { initialOf, relativeTime, type ForumComment, type ForumPost } from "./types";

const COLLAPSE_CHARS = 420;
const COLLAPSE_LINES = 8;
const SAVED_KEY = "cf_forum_saved";

function readSaved(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeSaved(ids: string[]) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
  } catch {}
}

export function PostCard({ post, onDeleted }: { post: ForumPost; onDeleted: (id: string) => void }) {
  const [voted, setVoted] = useState(post.voted);
  const [upvotes, setUpvotes] = useState(post.upvotes);
  const [voting, setVoting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setVoted(post.voted);
    setUpvotes(post.upvotes);
    setCommentsCount(post.commentsCount);
  }, [post.voted, post.upvotes, post.commentsCount]);

  useEffect(() => {
    setSaved(readSaved().includes(post.id));
  }, [post.id]);

  const isLong = post.content.length > COLLAPSE_CHARS || post.content.split("\n").length > COLLAPSE_LINES;

  async function toggleVote() {
    if (voting) return;
    setVoting(true);
    const prev = { voted, upvotes };
    setVoted(!voted);
    setUpvotes(upvotes + (voted ? -1 : 1));
    try {
      const res = await api<{ voted: boolean; upvotes: number }>(`/api/v1/forum/posts/${post.id}/vote`, { method: "POST" });
      setVoted(res.voted);
      setUpvotes(res.upvotes);
    } catch (e) {
      setVoted(prev.voted);
      setUpvotes(prev.upvotes);
      toast.error((e as Error).message);
    } finally {
      setVoting(false);
    }
  }

  async function share() {
    const url = `${window.location.origin}/forum#post-${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  function toggleSave() {
    const ids = readSaved();
    const next = ids.includes(post.id) ? ids.filter((x) => x !== post.id) : [...ids, post.id];
    writeSaved(next);
    setSaved(next.includes(post.id));
    toast.success(next.includes(post.id) ? "Publicação salva" : "Removida dos salvos");
  }

  async function remove() {
    if (!confirm("Excluir esta publicação e todos os comentários?")) return;
    try {
      await api(`/api/v1/forum/posts/${post.id}`, { method: "DELETE" });
      toast.success("Publicação excluída");
      onDeleted(post.id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <article id={`post-${post.id}`} className="flex gap-4 rounded-2xl border bg-card p-5 transition hover:border-primary/40">
      <div className="flex shrink-0 flex-col items-center gap-1">
        <button
          onClick={toggleVote}
          aria-pressed={voted}
          title={voted ? "Remover voto" : "Dar upvote"}
          className={cn(
            "flex size-9 items-center justify-center rounded-lg border transition cursor-pointer",
            voted ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
          )}
        >
          <ArrowBigUp className={cn("size-5", voted && "fill-current")} />
        </button>
        <span className={cn("font-mono text-sm font-bold", voted ? "text-primary" : "text-foreground")}>{upvotes}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">c/{categoryLabel(post.category)}</span>
          <span aria-hidden>•</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">{initialOf(post.author.name)}</span>
            {post.author.name}
          </span>
          {post.author.staff ? <Badge variant="purple">MODERADOR</Badge> : null}
          <span aria-hidden>•</span>
          <time dateTime={post.createdAt}>{relativeTime(timeAgo(post.createdAt))}</time>
        </p>

        <h3 className="mt-2 text-base font-semibold leading-snug md:text-lg">{post.title}</h3>

        <div className="relative mt-2">
          <p className={cn("whitespace-pre-line text-sm leading-relaxed text-foreground/85", isLong && !expanded && "max-h-40 overflow-hidden")}>{post.content}</p>
          {isLong && !expanded ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-card to-transparent" /> : null}
        </div>
        {isLong ? (
          <button onClick={() => setExpanded((v) => !v)} className="mt-1 text-xs font-semibold text-primary hover:underline cursor-pointer">
            {expanded ? "Ver menos" : "Ver mais"}
          </button>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <button onClick={() => setShowComments((v) => !v)} className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-2 transition hover:bg-secondary hover:text-foreground cursor-pointer", showComments && "text-foreground")}>
            <MessageCircle className="size-4" /> {commentsCount} {commentsCount === 1 ? "comentário" : "comentários"}
          </button>
          <span aria-hidden>·</span>
          <button onClick={share} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 transition hover:bg-secondary hover:text-foreground cursor-pointer">
            <Share2 className="size-4" /> Compartilhar
          </button>
          <span aria-hidden>·</span>
          <button onClick={toggleSave} className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-2 transition hover:bg-secondary hover:text-foreground cursor-pointer", saved && "text-primary")}>
            <Bookmark className={cn("size-4", saved && "fill-current")} /> {saved ? "Salvo" : "Salvar"}
          </button>
          {post.mine ? (
            <>
              <span aria-hidden>·</span>
              <button onClick={remove} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 transition hover:bg-destructive/10 hover:text-destructive cursor-pointer">
                <Trash2 className="size-4" /> Excluir
              </button>
            </>
          ) : null}
        </div>

        {showComments ? <Comments postId={post.id} onCountChange={setCommentsCount} /> : null}
      </div>
    </article>
  );
}

function Comments({ postId, onCountChange }: { postId: string; onCountChange: (n: number) => void }) {
  const { data, loading, setData } = useFetch<{ data: ForumComment[] }>(`/api/v1/forum/posts/${postId}/comments`);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const comments = data?.data || [];

  async function send() {
    const content = text.trim();
    if (!content) return;
    setSending(true);
    try {
      const res = await api<{ comment: ForumComment }>(`/api/v1/forum/posts/${postId}/comments`, { method: "POST", json: { content } });
      const next = [...comments, res.comment];
      setData({ data: next });
      onCountChange(next.length);
      setText("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 border-t pt-4">
      {loading && !data ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner /> Carregando comentários…
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">Ninguém comentou ainda. Seja o primeiro!</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold">{initialOf(c.author.name)}</span>
              <div className="min-w-0 flex-1 rounded-xl bg-secondary/50 px-3 py-2">
                <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{c.author.name}</span>
                  {c.author.staff ? <Badge variant="purple">MODERADOR</Badge> : null}
                  <span>{relativeTime(timeAgo(c.createdAt))}</span>
                </p>
                <p className="mt-1 whitespace-pre-line text-sm">{c.content}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Escreva um comentário…"
          maxLength={2000}
        />
        <Button size="icon" onClick={send} loading={sending} title="Enviar comentário" aria-label="Enviar comentário">
          {!sending ? <Send /> : null}
        </Button>
      </div>
    </div>
  );
}
