"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, SquareCheck, Loader2, Clapperboard } from "lucide-react";
import { useFetch, useUser } from "@/lib/hooks";
import { cn, formatClock, shortCode, timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { FreePlanNotice, Page } from "@/components/page-header";
import { EmptyState } from "@/components/ui/card";

interface Render {
  id: string;
  status: string;
  progress: number;
  url: string | null;
  durationSec: number;
  watermark: boolean;
  createdAt: string;
  short: { id: string; title: string; projectId: string; thumbnailUrl: string | null; startTime: number; endTime: number; project: { id: string; title: string } };
}
interface Resp {
  data: Render[];
  total: number;
  lastPage: number;
  doneCount: number;
  projects: { id: string; title: string }[];
}

export default function RendersPage() {
  const { user } = useUser();
  const [page, setPage] = useState(1);
  const [projectId, setProjectId] = useState("");
  const { data } = useFetch<Resp>(`/api/v1/renders?page=${page}&limit=20${projectId ? `&projectId=${projectId}` : ""}`, { refreshMs: 4000 });
  const items = data?.data || [];
  const groups = groupByDay(items);

  return (
    <Page wide>
      <p className="eyebrow flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-success" /> Renders · Linha de produção
      </p>
      <h1 className="mt-3 text-5xl font-black leading-[0.95] tracking-tight md:text-6xl">
        <span className="rounded bg-primary/30 px-1">{data?.doneCount ?? 0}</span> vídeos
        <br />
        já <span className="font-serif font-medium italic text-muted-foreground">renderizados.</span>
      </h1>
      <p className="mt-4 max-w-xl font-serif text-lg italic text-muted-foreground">A fila completa de produção: o que está esperando, o que está saindo do forno e o que já está pronto pra publicar.</p>
      <div className="mt-6 h-px w-24 bg-foreground/60" />

      {user && !user.isSubscriber ? (
        <div className="mt-8">
          <FreePlanNotice text="Seus vídeos saem com marca d'água. Assine qualquer plano e ela é removida de todos os seus vídeos, inclusive os que você já criou." />
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="eyebrow">Projeto</span>
        <NativeSelect value={projectId} onChange={(e) => setProjectId(e.target.value)} className="font-mono text-xs">
          <option value="">Todos os projetos</option>
          {data?.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </NativeSelect>
        <div className="flex-1" />
        <Button
          disabled={!items.some((r) => r.url)}
          onClick={() => {
            items.filter((r) => r.url).forEach((r, i) => setTimeout(() => window.open(`${r.url}?download=${encodeURIComponent(r.short.title)}.mp4`, "_blank"), i * 400));
          }}
        >
          <Download /> Baixar todos <span className="rounded bg-white/20 px-1.5 text-xs">{items.filter((r) => r.url).length}</span>
        </Button>
        <Button variant="secondary">
          <SquareCheck /> Selecionar
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState className="mt-6" icon={<Clapperboard />} title="Nenhum vídeo encontrado." description="Gere seus cortes para ver os vídeos aqui" />
      ) : (
        groups.map((g) => (
          <div key={g.day} className="mt-8">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold">{g.label}</p>
              <span className="eyebrow">{g.items.length} renders</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="mt-3 divide-y rounded-2xl border bg-card">
              {g.items.map((r) => (
                <div key={r.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                  <div className="flex items-center gap-3 md:w-40">
                    <span className={cn("eyebrow !text-[10px]", r.status === "done" ? "!text-success" : r.status === "failed" ? "!text-destructive" : "!text-sky-400")}>{r.status === "done" ? "Concluído" : r.status === "failed" ? "Falhou" : r.status === "processing" ? `Renderizando ${r.progress}%` : "Na fila"}</span>
                    <span className="font-mono text-xs text-muted-foreground">{formatClock(r.durationSec || r.short.endTime - r.short.startTime)}</span>
                  </div>
                  <div className="h-14 w-8 shrink-0 overflow-hidden rounded-md bg-secondary">{r.short.thumbnailUrl ? <img src={r.short.thumbnailUrl} alt="" className="size-full object-cover" /> : null}</div>
                  <div className="min-w-0 flex-1">
                    <p className="eyebrow truncate">
                      {r.short.project.title} <span className="ml-2 text-foreground/60">№ {shortCode(r.short.id)}</span>
                    </p>
                    <Link href={`/projects/${r.short.projectId}`} className="mt-0.5 block truncate text-sm font-semibold hover:text-primary">
                      {r.short.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</p>
                  </div>
                  {r.status === "done" && r.url ? (
                    <Button asChild size="sm" variant="secondary">
                      <a href={`${r.url}?download=${encodeURIComponent(r.short.title)}.mp4`}>
                        <Download /> Download
                      </a>
                    </Button>
                  ) : r.status === "failed" ? (
                    <span className="text-xs text-destructive">Falhou</span>
                  ) : (
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> {r.progress}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          Mostrando {data?.total ? (page - 1) * 20 + 1 : 0} a {Math.min(page * 20, data?.total ?? 0)} de {data?.total ?? 0} vídeos
        </span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">{page}</span>
          <Button variant="secondary" size="sm" disabled={page >= (data?.lastPage ?? 1)} onClick={() => setPage((p) => p + 1)}>
            Próximo
          </Button>
        </div>
      </div>
    </Page>
  );
}

function groupByDay(items: Render[]) {
  const map = new Map<string, Render[]>();
  for (const r of items) {
    const d = new Date(r.createdAt);
    const key = d.toISOString().slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  const today = new Date().toISOString().slice(0, 10);
  return [...map.entries()].map(([day, items]) => {
    const d = new Date(day + "T12:00:00");
    const label = `${day === today ? "Hoje" : d.toLocaleDateString("pt-BR", { weekday: "short" })}· ${d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`;
    return { day, label, items };
  });
}
