"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Clock, Pause, Pencil, Play, Plus, Rocket, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api, useFetch } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/page-header";
import { Skeleton } from "@/components/ui/progress";
import { PlatformDot } from "@/components/shared/platform";
import { AddClipDialog, LauncherDialog, type LauncherItemRow, type LauncherRow } from "@/components/launcher/launcher-dialogs";

export default function LauncherPage() {
  return (
    <Suspense fallback={null}>
      <LauncherInner />
    </Suspense>
  );
}

function LauncherInner() {
  const params = useSearchParams();
  const addShort = params.get("add");
  const { data, loading, reload } = useFetch<{ data: LauncherRow[] }>("/api/v1/launchers", { refreshMs: 20000 });
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<LauncherRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<string | null>(null);
  const [addShortId, setAddShortId] = useState<string | null>(null);
  const launchers = data?.data ?? [];

  useEffect(() => {
    if (addShort && data) {
      setAddShortId(addShort);
      setAddTarget(null);
      setAddOpen(true);
    }
  }, [addShort, data]);

  async function remove(l: LauncherRow) {
    if (!confirm(`Excluir o launcher "${l.name}" e sua fila?`)) return;
    try {
      await api(`/api/v1/launchers/${l.id}`, { method: "DELETE" });
      toast.success("Launcher excluído");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function toggleStatus(l: LauncherRow) {
    try {
      await api(`/api/v1/launchers/${l.id}`, { method: "PATCH", json: { status: l.status === "active" ? "paused" : "active" } });
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function removeItem(l: LauncherRow, it: LauncherItemRow) {
    try {
      await api(`/api/v1/launchers/${l.id}/items/${it.id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Page wide>
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center rounded-2xl border bg-card p-6">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-success" /> Publicar · Automação
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Launchers</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Fila de auto-postagem. Adicione clipes, o Cortix publica no horário certo.</p>
        </div>
        <Button
          size="lg"
          onClick={() => {
            setEditing(null);
            setCreateOpen(true);
          }}
        >
          <Plus /> Novo launcher
        </Button>
      </div>

      {loading && !data ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : launchers.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Rocket className="size-7" />
          </div>
          <p className="text-lg font-semibold">Nenhum launcher ainda</p>
          <p className="max-w-md text-sm text-muted-foreground">Crie um launcher, conecte contas, defina horários e adicione clipes. A publicação é automática.</p>
          <Button
            className="mt-2"
            onClick={() => {
              setEditing(null);
              setCreateOpen(true);
            }}
          >
            <Plus /> Criar primeiro launcher
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {launchers.map((l) => (
            <div key={l.id} className={cn("flex flex-col rounded-2xl border bg-card", l.status === "paused" && "opacity-80")}>
              <div className="flex items-start gap-3 p-5">
                <div className="flex -space-x-1.5">
                  {l.platforms.map((p) => (
                    <PlatformDot key={p} platform={p} size="lg" className="ring-2 ring-card" />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{l.name}</p>
                    <span className={cn("rounded px-1.5 py-0.5 font-mono text-[9px] uppercase", l.status === "active" ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground")}>{l.status === "active" ? "Ativo" : "Pausado"}</span>
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1 font-mono text-[11px] text-muted-foreground">
                    <Clock className="size-3" />
                    {l.times.map((t) => (
                      <span key={t} className="rounded bg-secondary px-1">
                        {t}
                      </span>
                    ))}
                  </p>
                  <p className="mt-2 text-xs">
                    {l.nextPostAt && l.status === "active" ? (
                      <>
                        Próximo post: <span className="font-semibold text-primary">{new Date(l.nextPostAt).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                      </>
                    ) : l.status === "paused" ? (
                      <span className="text-muted-foreground">Launcher pausado</span>
                    ) : (
                      <span className="text-muted-foreground">Fila vazia — adicione clipes</span>
                    )}
                    <span className="ml-2 text-muted-foreground">
                      · {l.queuedCount} na fila · {l.postedCount} postados
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button className="rounded-lg border p-2 hover:bg-secondary" title={l.status === "active" ? "Pausar" : "Retomar"} onClick={() => toggleStatus(l)}>
                    {l.status === "active" ? <Pause className="size-4" /> : <Play className="size-4" />}
                  </button>
                  <button
                    className="rounded-lg border p-2 hover:bg-secondary"
                    title="Editar"
                    onClick={() => {
                      setEditing(l);
                      setCreateOpen(true);
                    }}
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button className="rounded-lg border p-2 text-destructive hover:bg-destructive/10" title="Excluir" onClick={() => remove(l)}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div className="border-t px-5 py-4">
                <div className="flex items-center justify-between">
                  <p className="eyebrow">Fila de clipes</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setAddTarget(l.id);
                      setAddShortId(null);
                      setAddOpen(true);
                    }}
                  >
                    <Plus /> Adicionar clipe
                  </Button>
                </div>
                {l.items.length === 0 ? (
                  <p className="mt-3 rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">Nenhum clipe na fila.</p>
                ) : (
                  <div className="scrollbar-thin mt-3 flex gap-2 overflow-x-auto pb-2">
                    {l.items.map((it, i) => (
                      <div key={it.id} className={cn("group relative w-20 shrink-0", it.status === "posted" && "opacity-50")}>
                        <Link href={`/projects/${it.short.projectId}`} className="block aspect-[9/16] overflow-hidden rounded-lg border bg-secondary" title={it.short.title}>
                          {it.short.thumbnailUrl ? <img src={it.short.thumbnailUrl} alt="" className="size-full object-cover" /> : null}
                          <span className="absolute left-1 top-1 rounded bg-black/70 px-1 font-mono text-[9px] text-white">#{i + 1}</span>
                        </Link>
                        {it.status !== "posted" ? (
                          <button onClick={() => removeItem(l, it)} className="absolute right-1 top-1 hidden rounded-full bg-black/80 p-0.5 text-white group-hover:block" title="Remover da fila">
                            <X className="size-3" />
                          </button>
                        ) : null}
                        <p className="mt-1 truncate text-[10px] font-medium">{it.short.title}</p>
                        <p className={cn("font-mono text-[9px]", it.status === "posted" ? "text-success" : "text-muted-foreground")}>
                          {it.status === "posted" ? "Postado" : it.postAt ? new Date(it.postAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Na fila"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <LauncherDialog open={createOpen} onOpenChange={setCreateOpen} launcher={editing} onSaved={reload} />
      <AddClipDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        launchers={launchers}
        launcherId={addTarget}
        shortId={addShortId}
        onSaved={reload}
        onCreateLauncher={() => {
          setAddOpen(false);
          setEditing(null);
          setCreateOpen(true);
        }}
      />
    </Page>
  );
}
