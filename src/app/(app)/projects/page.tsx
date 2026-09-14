"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ExternalLink, Pencil, Search, Trash2, Coins } from "lucide-react";
import { toast } from "sonner";
import { api, useFetch, useUser } from "@/lib/hooks";
import { cn, formatDuration, timeAgo } from "@/lib/utils";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FreePlanNotice, Page } from "@/components/page-header";

interface Project {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  channelTitle: string | null;
  status: string;
  stage: string | null;
  progress: number;
  durationSec: number;
  createdAt: string;
  expiresAt: string | null;
  shortsCount: number;
  goal: string;
  creditsCharged: number;
  isFree: boolean;
}

export default function ProjectsPage() {
  const { user } = useUser();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("recent");
  const url = `/api/v1/projects?q=${encodeURIComponent(q)}&status=${status}&sort=${sort}&limit=48`;
  const { data, reload } = useFetch<{ data: Project[]; total: number }>(url, { refreshMs: 6000 });
  const items = data?.data || [];

  async function remove(p: Project) {
    if (!confirm(`Excluir o projeto "${p.title}" e todos os cortes?`)) return;
    try {
      await api(`/api/v1/projects/${p.id}`, { method: "DELETE" });
      toast.success("Projeto excluído");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Page wide>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-success" /> Cortes · Projetos
          </p>
          <h1 className="mt-3 text-5xl font-black leading-[0.95] tracking-tight md:text-6xl">
            <span className="rounded bg-primary/30 px-1">{data?.total ?? 0}</span> projetos
            <br />
            gerando <span className="font-serif font-medium italic text-muted-foreground">cortes virais.</span>
          </h1>
          <div className="mt-6 h-px w-40 bg-foreground/60" />
        </div>
        <Link href="/criar-projeto" className="glow group rounded-2xl border border-primary/60 bg-card p-5">
          <p className="eyebrow !text-primary">Novo</p>
          <p className="mt-2 text-lg font-bold">
            Crie um <span className="font-serif font-medium italic">novo projeto.</span>
          </p>
          <p className="eyebrow mt-3 flex items-center gap-2 !text-primary">
            Começar agora <ArrowRight className="size-3 transition group-hover:translate-x-1" />
          </p>
        </Link>
      </div>

      {user && !user.isSubscriber ? (
        <div className="mt-8">
          <FreePlanNotice />
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-[1fr_150px_170px_170px]">
        <div>
          <Label className="eyebrow">Buscar</Label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Título do projeto…" className="pl-9" />
          </div>
        </div>
        <div>
          <Label className="eyebrow">Status</Label>
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full">
            <option value="all">Todos</option>
            <option value="ready">Prontos</option>
            <option value="generating">Processando</option>
            <option value="failed">Falhou</option>
            <option value="expired">Expirados</option>
          </NativeSelect>
        </div>
        <div>
          <Label className="eyebrow">Formato</Label>
          <NativeSelect className="mt-1 w-full" defaultValue="all">
            <option value="all">Todos os formatos</option>
            <option value="vertical">9:16 vertical</option>
          </NativeSelect>
        </div>
        <div>
          <Label className="eyebrow">Ordenar</Label>
          <NativeSelect value={sort} onChange={(e) => setSort(e.target.value)} className="mt-1 w-full">
            <option value="recent">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
            <option value="title">Título (A-Z)</option>
          </NativeSelect>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
          <p className="text-xl font-bold">Seu primeiro corte viral começa aqui.</p>
          <p className="max-w-md text-sm text-muted-foreground">Cole uma URL do YouTube e nossa IA recorta os melhores momentos prontos pra publicar.</p>
          <Button asChild className="mt-2">
            <Link href="/criar-projeto">Começar agora</Link>
          </Button>
        </div>
      ) : (
        <>
          <p className="eyebrow mt-8">
            Seus projetos <span className="ml-2 text-foreground">{items.length} projetos</span>
          </p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((p, i) => (
              <div key={p.id} className="group">
                <Link href={`/projects/${p.id}`} className="relative block aspect-video overflow-hidden rounded-xl border bg-secondary">
                  {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt="" className="size-full object-cover transition group-hover:scale-105" /> : null}
                  <div className="absolute inset-x-0 top-0 h-1 bg-primary" style={{ width: `${p.status === "ready" ? 100 : p.progress}%` }} />
                  <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">№ {String(items.length - i).padStart(3, "0")}</span>
                  <span className="absolute right-2 top-2 rounded bg-sky-500 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-white">{p.goal === "reframe" ? "Reframe" : "Cortes"}</span>
                  <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">{formatDuration(p.durationSec)}</span>
                </Link>
                <p className="eyebrow mt-3">
                  {p.channelTitle || "Arquivo"} <span className="ml-2 text-foreground/70">{timeAgo(p.createdAt)}</span>
                </p>
                <Link href={`/projects/${p.id}`} className="mt-1 line-clamp-2 block text-base font-semibold leading-snug hover:text-primary">
                  {p.title}
                </Link>
                <div className="mt-2 flex items-center justify-between border-b pb-2 font-mono text-[11px]">
                  <span className={cn("flex items-center gap-1.5", p.status === "ready" ? "text-success" : p.status === "failed" ? "text-destructive" : "text-sky-400")}>
                    <span className="size-1.5 rounded-sm bg-current" />
                    {p.status === "ready" ? `${p.shortsCount} cortes` : p.status === "failed" ? "Falhou" : p.status === "expired" ? "Expirado" : `${p.stage || "Processando"} ${p.progress}%`}
                  </span>
                  <span className="uppercase text-muted-foreground">{p.isFree ? "Grátis" : `${p.creditsCharged} cr`}</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <Link href={`/projects/${p.id}`} className="rounded-lg border p-2 hover:bg-secondary" title="Abrir">
                    <ExternalLink className="size-4" />
                  </Link>
                  <Link href={`/projects/${p.id}`} className="rounded-lg border p-2 hover:bg-secondary" title="Editar">
                    <Pencil className="size-4" />
                  </Link>
                  <Link href="/financeiro" className="rounded-lg border p-2 hover:bg-secondary" title="Créditos">
                    <Coins className="size-4" />
                  </Link>
                  <button onClick={() => remove(p)} className="rounded-lg border p-2 text-destructive hover:bg-destructive/10" title="Excluir">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Page>
  );
}
