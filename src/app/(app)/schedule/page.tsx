"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Layers, List, Plus, ShieldCheck, Trash2, XCircle, Pencil, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { api, useFetch } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Page, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlatformDot, platformInfo } from "@/components/shared/platform";
import { BatchDialog, NewPostDialog, type ScheduledPostItem } from "@/components/schedule/post-dialogs";

const STATUS: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Agendado", cls: "text-sky-400" },
  published: { label: "Publicado", cls: "text-success" },
  failed: { label: "Falhou", cls: "text-destructive" },
  canceled: { label: "Cancelado", cls: "text-muted-foreground" },
};

export default function SchedulePage() {
  return (
    <Suspense fallback={null}>
      <ScheduleInner />
    </Suspense>
  );
}

function ScheduleInner() {
  const params = useSearchParams();
  const preselect = params.get("short");
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [newOpen, setNewOpen] = useState(!!preselect);
  const [batchOpen, setBatchOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduledPostItem | null>(null);
  const [detail, setDetail] = useState<ScheduledPostItem | null>(null);

  const from = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const to = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const url = view === "calendar" ? `/api/v1/schedule?from=${from.toISOString()}&to=${to.toISOString()}` : "/api/v1/schedule";
  const { data, reload } = useFetch<{ data: ScheduledPostItem[]; stats: Record<string, number> }>(url, { refreshMs: 15000 });
  const posts = useMemo(() => data?.data ?? [], [data]);
  const days = useMemo(() => eachDayOfInterval({ start: from, end: to }), [from, to]);

  async function remove(p: ScheduledPostItem) {
    if (!confirm("Excluir este post agendado?")) return;
    try {
      await api(`/api/v1/schedule/${p.id}`, { method: "DELETE" });
      toast.success("Post excluído");
      setDetail(null);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function cancel(p: ScheduledPostItem) {
    try {
      await api(`/api/v1/schedule/${p.id}`, { method: "PATCH", json: { status: p.status === "canceled" ? "scheduled" : "canceled" } });
      toast.success(p.status === "canceled" ? "Post reativado" : "Post cancelado");
      setDetail(null);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, ScheduledPostItem[]>();
    for (const p of posts) {
      const key = format(new Date(p.scheduledAt), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [posts]);

  return (
    <Page wide>
      <PageHeader
        eyebrow="Publicar · Agenda"
        dot
        title="Agendamento"
        description="Gerencie seus posts agendados para YouTube, Instagram e TikTok"
        actions={
          <>
            <div className="inline-flex h-10 items-center rounded-lg bg-secondary/70 p-1">
              <button onClick={() => setView("calendar")} className={cn("flex h-full items-center gap-1.5 rounded-md px-3 text-sm font-medium", view === "calendar" ? "bg-background shadow" : "text-muted-foreground")}>
                <CalendarDays className="size-4" /> Calendário
              </button>
              <button onClick={() => setView("list")} className={cn("flex h-full items-center gap-1.5 rounded-md px-3 text-sm font-medium", view === "list" ? "bg-background shadow" : "text-muted-foreground")}>
                <List className="size-4" /> Lista
              </button>
            </div>
            <Button variant="secondary" onClick={() => setBatchOpen(true)}>
              <Layers /> Agendar em Lote
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setNewOpen(true);
              }}
            >
              <Plus /> Novo Post
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3 rounded-2xl border border-success/30 bg-success/5 p-5 md:flex-row">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
            <ShieldCheck className="size-5" />
          </div>
          <div className="text-sm">
            <p className="eyebrow !text-success">Proteja suas contas</p>
            <p className="mt-1 font-semibold">Recomendação — Evite excesso de publicações e restrições das redes</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>· 3 posts no máximo por conta e por rede em 24 horas</li>
              <li>· Intervalo mínimo de 2 horas entre posts da mesma conta</li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Agendado não significa publicado.</span> No horário escolhido, o Cortix envia o conteúdo para a rede; a publicação depende da conta estar conectada e sem restrições.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Agendados" value={data?.stats.scheduled ?? 0} cls="text-sky-400" />
          <Stat label="Publicados" value={data?.stats.published ?? 0} cls="text-success" />
          <Stat label="Cancelados" value={data?.stats.canceled ?? 0} cls="text-muted-foreground" />
          <Stat label="Falharam" value={data?.stats.failed ?? 0} cls="text-destructive" />
        </div>
      </div>

      {view === "calendar" ? (
        <div className="mt-6 rounded-2xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <button className="rounded-md border p-1.5 hover:bg-secondary" onClick={() => setMonth((m) => subMonths(m, 1))}>
              <ChevronLeft className="size-4" />
            </button>
            <div className="text-center">
              <p className="font-semibold capitalize">{format(month, "MMMM yyyy", { locale: ptBR })}</p>
              <button className="text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setMonth(startOfMonth(new Date()))}>
                Ir para hoje
              </button>
            </div>
            <button className="rounded-md border p-1.5 hover:bg-secondary" onClick={() => setMonth((m) => addMonths(m, 1))}>
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 border-b text-center">
            {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => (
              <div key={d} className="eyebrow py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dayPosts = posts.filter((p) => isSameDay(new Date(p.scheduledAt), day));
              const inMonth = isSameMonth(day, month);
              return (
                <div key={day.toISOString()} className={cn("min-h-24 border-b border-r p-1.5 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-secondary/20 text-muted-foreground/60")}>
                  <div className="flex items-center justify-between">
                    <span className={cn("flex size-6 items-center justify-center rounded-full text-xs", isToday(day) && "bg-primary font-bold text-white")}>{format(day, "d")}</span>
                    {inMonth ? (
                      <button
                        className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-secondary hover:opacity-100 [div:hover>div>&]:opacity-100"
                        title="Novo post neste dia"
                        onClick={() => {
                          setEditing(null);
                          setNewOpen(true);
                        }}
                      >
                        <Plus className="size-3" />
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-1 space-y-1">
                    {dayPosts.slice(0, 3).map((p) => (
                      <button key={p.id} onClick={() => setDetail(p)} className={cn("flex w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-left text-[10px] hover:bg-secondary", p.status === "canceled" && "opacity-50 line-through", p.status === "published" && "border-success/40")} style={{ borderLeftColor: platformInfo(p.platform).color, borderLeftWidth: 3 }}>
                        <span className="font-mono">{format(new Date(p.scheduledAt), "HH:mm")}</span>
                        <span className="truncate">{p.short?.title ?? p.caption ?? "Post"}</span>
                      </button>
                    ))}
                    {dayPosts.length > 3 ? <p className="px-1 text-[10px] text-muted-foreground">+{dayPosts.length - 3} mais</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : posts.length === 0 ? (
        <EmptyState className="mt-6" icon={<CalendarClock />} title="Nenhum post agendado" description="Agende seu primeiro corte pra sair no melhor horário." action={<Button onClick={() => setNewOpen(true)}><Plus /> Novo Post</Button>} />
      ) : (
        <div className="mt-6 space-y-6">
          {grouped.map(([day, items]) => {
            const d = new Date(day + "T12:00:00");
            return (
              <div key={day}>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold capitalize">{isToday(d) ? "Hoje" : format(d, "EEEE", { locale: ptBR })}</p>
                  <span className="eyebrow">{format(d, "d 'de' MMMM", { locale: ptBR })}</span>
                  <span className="eyebrow">{items.length} posts</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="mt-3 divide-y rounded-2xl border bg-card">
                  {items.map((p) => (
                    <PostRow key={p.id} p={p} onOpen={() => setDetail(p)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewPostDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        preselectShortId={editing ? null : preselect}
        post={editing}
        onSaved={reload}
      />
      <BatchDialog open={batchOpen} onOpenChange={setBatchOpen} onSaved={reload} />

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent>
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PlatformDot platform={detail.platform} size="sm" /> {detail.short?.title ?? "Post"}
                </DialogTitle>
                <DialogDescription>
                  {format(new Date(detail.scheduledAt), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })} · <span className={STATUS[detail.status]?.cls}>{STATUS[detail.status]?.label}</span>
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-3">
                <div className="h-28 w-16 shrink-0 overflow-hidden rounded-lg bg-secondary">{detail.short?.thumbnailUrl ? <img src={detail.short.thumbnailUrl} alt="" className="size-full object-cover" /> : null}</div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="text-xs text-muted-foreground">
                    {platformInfo(detail.platform).name} · {detail.socialAccount?.handle ?? "sem conta vinculada"}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-xs">{detail.caption || <span className="text-muted-foreground">Sem legenda</span>}</p>
                  {detail.short ? (
                    <Link href={`/projects/${detail.short.projectId}`} className="mt-2 inline-block text-xs text-primary hover:underline">
                      Abrir projeto {detail.short.project.title} ↗
                    </Link>
                  ) : null}
                </div>
              </div>
              <DialogFooter className="flex-wrap">
                <Button variant="outline" size="sm" onClick={() => remove(detail)}>
                  <Trash2 /> Excluir
                </Button>
                {detail.status !== "published" ? (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => cancel(detail)}>
                      <XCircle /> {detail.status === "canceled" ? "Reativar" : "Cancelar"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditing(detail);
                        setDetail(null);
                        setNewOpen(true);
                      }}
                    >
                      <Pencil /> Editar
                    </Button>
                  </>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Page>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className={cn("mt-1 font-mono text-2xl font-bold", cls)}>{value}</p>
    </div>
  );
}

function PostRow({ p, onOpen }: { p: ScheduledPostItem; onOpen: () => void }) {
  const s = STATUS[p.status] ?? STATUS.scheduled;
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 p-3 text-left hover:bg-secondary/40">
      <span className="w-14 font-mono text-sm">{format(new Date(p.scheduledAt), "HH:mm")}</span>
      <PlatformDot platform={p.platform} />
      <div className="h-12 w-7 shrink-0 overflow-hidden rounded-md bg-secondary">{p.short?.thumbnailUrl ? <img src={p.short.thumbnailUrl} alt="" className="size-full object-cover" /> : null}</div>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-semibold", p.status === "canceled" && "line-through opacity-60")}>{p.short?.title ?? p.caption ?? "Post"}</p>
        <p className="truncate text-xs text-muted-foreground">{p.socialAccount?.handle ?? "sem conta vinculada"}{p.short ? ` · ${p.short.project.title}` : ""}</p>
      </div>
      <span className={cn("eyebrow !text-[10px]", s.cls)}>{s.label}</span>
    </button>
  );
}
