"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, ExternalLink, Hourglass, Link2, MoreVertical, Pencil, Play, Plus, RefreshCw, Scissors, Share2, Smartphone, SquareCheck, Trash2, Upload, Maximize2, Loader2, Sparkles, Calendar, Clock, Rocket } from "lucide-react";
import { toast } from "sonner";
import { api, useFetch, useUser } from "@/lib/hooks";
import { cn, formatClock, formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress, Spinner } from "@/components/ui/progress";
import { NativeSelect } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Page, Paywall } from "@/components/page-header";

interface Short {
  id: string;
  title: string;
  reason: string | null;
  score: number;
  startTime: number;
  endTime: number;
  status: string;
  renderProgress: number;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  renderUrl: string | null;
  watermark: boolean;
  layout: string;
}
interface Project {
  id: string;
  title: string;
  url: string | null;
  thumbnailUrl: string | null;
  channelTitle: string | null;
  durationSec: number;
  status: string;
  stage: string | null;
  progress: number;
  error: string | null;
  createdAt: string;
  expiresAt: string | null;
  targetClips: number;
  shortsCount: number;
  isFree: boolean;
}
interface Resp {
  project: Project;
  data: Short[];
  total: number;
  lastPage: number;
  meta: { averageScore: number; averageDuration: number };
}

const FILTERS = [
  ["all", "Todos"],
  ["rendered", "Renderizados"],
  ["not_rendered", "Não renderizados"],
  ["launcher", "No Launcher"],
  ["scheduled", "Agendados"],
  ["published", "Publicados"],
];

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useUser();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [sort, setSort] = useState("score");
  const [filter, setFilter] = useState("all");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [renderingId, setRenderingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState(false);
  const url = `/api/v1/projects/${id}?page=${page}&limit=${limit}&sort=${sort}&filter=${filter}`;
  const { data, reload, error } = useFetch<Resp>(url, { refreshMs: 3000 });
  const project = data?.project;
  const processing = project && !["ready", "failed", "expired"].includes(project.status);
  const readyCount = data?.data.filter((s) => s.status !== "pending").length ?? 0;

  async function render(s: Short) {
    setRenderingId(s.id);
    try {
      await api(`/api/v1/shorts/${s.id}/render`, { method: "POST", json: {} });
      reload();
    } catch (e) {
      toast.error((e as Error).message);
      setRenderingId(null);
    }
  }

  async function removeShort(s: Short) {
    if (!confirm(`Excluir o corte "${s.title}"?`)) return;
    await api(`/api/v1/shorts/${s.id}`, { method: "DELETE" });
    reload();
  }

  async function retry() {
    try {
      await api(`/api/v1/projects/${id}`, { method: "POST" });
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function saveTitle(t: string) {
    setEditTitle(false);
    if (!t.trim() || t === project?.title) return;
    await api(`/api/v1/projects/${id}`, { method: "PATCH", json: { title: t.trim() } });
    reload();
  }

  if (error) {
    return (
      <Page>
        <p className="text-destructive">{error}</p>
      </Page>
    );
  }
  if (!project) {
    return (
      <Page>
        <div className="flex items-center gap-3 text-muted-foreground">
          <Spinner /> Carregando projeto…
        </div>
      </Page>
    );
  }

  const daysLeft = project.expiresAt ? Math.max(0, Math.ceil((new Date(project.expiresAt).getTime() - Date.now()) / 86400000)) : null;
  const renderingShort = renderingId ? data?.data.find((s) => s.id === renderingId) : null;

  return (
    <div className="relative flex h-full">
      <div className="scrollbar-thin min-w-0 flex-1 overflow-y-auto">
        <Page wide>
          <div className="rounded-3xl border bg-card p-4 md:p-5">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl bg-secondary md:w-64">
                {project.thumbnailUrl ? <img src={project.thumbnailUrl} alt="" className="size-full object-cover" /> : null}
                <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-white">{formatDuration(project.durationSec).replace(":", "m ")}s</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
                    <Play className="size-3 fill-current" />
                  </span>
                  {editTitle ? (
                    <input autoFocus defaultValue={project.title} onBlur={(e) => saveTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveTitle((e.target as HTMLInputElement).value)} className="w-full rounded-md border bg-background px-2 py-1 text-xl font-bold outline-none" />
                  ) : (
                    <h1 className="text-xl font-bold leading-tight md:text-2xl">{project.title}</h1>
                  )}
                  <button onClick={() => setEditTitle(true)} className="mt-1 rounded p-1 text-muted-foreground hover:bg-secondary" title="Renomear">
                    <Pencil className="size-4" />
                  </button>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{project.channelTitle || "Arquivo enviado"}</p>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Scissors className="size-4" /> {project.shortsCount} clipes
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-4" /> {formatDuration(project.durationSec).replace(":", "m ")}s
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="size-4" /> {new Date(project.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
                  </span>
                  {daysLeft !== null ? (
                    <span className="flex items-center gap-1.5">
                      <Hourglass className="size-4 text-warning" /> Expira em {daysLeft} dias
                    </span>
                  ) : null}
                </div>
              </div>
              {project.url ? (
                <a href={project.url} target="_blank" rel="noreferrer" className="inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-xl border bg-secondary px-4 text-sm font-semibold hover:bg-secondary/70">
                  Abrir original <ExternalLink className="size-4" />
                </a>
              ) : null}
            </div>
            {processing || project.status === "ready" ? (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-semibold">
                    {processing ? <Spinner /> : <Check className="size-4 text-success" />}
                    {processing ? "Novos cortes aparecem aqui assim que ficam prontos." : "Todos os cortes estão prontos."}
                  </span>
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-success">{readyCount} disponíveis</span> · {project.targetClips} previstos
                  </span>
                </div>
                <Progress className="mt-2" value={processing ? Math.max(project.progress, (readyCount / Math.max(1, project.targetClips)) * 100) : 100} />
              </div>
            ) : null}
            {project.status === "failed" ? (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
                <span>
                  <b>Falhou:</b> {project.error}
                </span>
                <Button size="sm" variant="secondary" onClick={retry}>
                  <RefreshCw /> Tentar de novo
                </Button>
              </div>
            ) : null}
            {project.status === "expired" ? <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">Este projeto gratuito expirou. Assine um plano para manter seus projetos por 60 dias.</div> : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="soft" onClick={() => navigator.clipboard.writeText(location.href).then(() => toast.success("Link copiado"))}>
              <Share2 /> Compartilhar
            </Button>
            <div className="flex-1" />
            <Button onClick={() => router.push(`/criar-projeto?url=${encodeURIComponent(project.url || "")}`)}>
              <Plus /> Novo Clipe
            </Button>
            <Button variant="secondary" onClick={() => router.push("/library")}>
              <Upload /> Importar vídeos
            </Button>
            <Button variant="secondary">
              <SquareCheck /> Selecionar
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <p className="mr-auto text-lg text-muted-foreground">
              Ajuste, edite legendas ou
              <br className="hidden md:block" /> baixe seus clipes.
            </p>
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-3 text-sm">
              <Smartphone className="size-4" /> Formato vertical
            </span>
            <NativeSelect value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              {[12, 24, 36, 48, 60, 72, 84, 96].map((n) => (
                <option key={n} value={n}>
                  {n} / pág
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={filter} onChange={(e) => setFilter(e.target.value)}>
              {FILTERS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
            <span className="inline-flex h-10 items-center rounded-xl border bg-card px-3 text-sm text-muted-foreground">{data?.total ?? 0} cortes</span>
            <NativeSelect value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="score">Mais virais primeiro</option>
              <option value="time">Por Tempo</option>
              <option value="duration">Por Duração</option>
              <option value="title">Título (A-Z)</option>
            </NativeSelect>
          </div>

          {processing && readyCount === 0 ? <GenerationBox project={project} /> : null}

          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.data
              .filter((s) => s.status !== "pending")
              .map((s) => (
                <ClipCard key={s.id} short={s} projectId={id} onRender={() => render(s)} onDelete={() => removeShort(s)} rendering={renderingId === s.id} isSubscriber={!!user?.isSubscriber} />
              ))}
          </div>
          {!user?.isSubscriber && project.isFree && readyCount > 0 ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="size-4 text-primary" /> Seus vídeos saem com marca d&apos;água. Assine qualquer plano e ela é removida de todos os seus vídeos, inclusive os que você já criou.{" "}
              <Link href="/financeiro?tab=plans" className="font-semibold text-primary underline-offset-4 hover:underline">
                Ver planos disponíveis
              </Link>
            </p>
          ) : null}
          {processing && readyCount > 0 ? (
            <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border bg-card px-4 py-5 text-sm text-muted-foreground">
              <Spinner /> Buscando mais cortes. Os que já estão prontos podem ser usados agora.
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Mostrando {data?.total ? (page - 1) * limit + 1 : 0} a {Math.min(page * limit, data?.total ?? 0)} de {data?.total ?? 0} cortes
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ‹ Anterior
              </Button>
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">{page}</span>
              <Button variant="secondary" size="sm" disabled={page >= (data?.lastPage ?? 1)} onClick={() => setPage((p) => p + 1)}>
                Próximo ›
              </Button>
            </div>
          </div>
        </Page>
      </div>

      <button onClick={() => setBulkOpen(true)} className="absolute right-0 top-24 z-10 flex flex-col items-center gap-2 rounded-l-2xl bg-gradient-to-b from-primary to-fuchsia-600 px-2 py-4 text-white shadow-xl" title="Edição em massa">
        <SquareCheck className="size-5" />
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest [writing-mode:vertical-rl]">Edição em massa</span>
      </button>
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" /> Editor em Massa
            </DialogTitle>
          </DialogHeader>
          {user?.isSubscriber ? (
            <BulkEditor projectId={id} shorts={data?.data || []} onDone={() => (setBulkOpen(false), reload())} />
          ) : (
            <Paywall title="Recurso exclusivo para assinantes" description="A edição em massa é um recurso disponível apenas para assinantes. Assine um plano para desbloquear esta e outras funcionalidades." />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!renderingShort && renderingShort.status === "rendering"} onOpenChange={(v) => !v && setRenderingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">🎬 Gerando Vídeo</DialogTitle>
            <DialogDescription>Preparando seu corte… pronto em até 30 segundos. Legendas e enquadramento já vão embutidos.</DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center">
            <p className="text-6xl font-black text-primary">{renderingShort?.renderProgress ? `${renderingShort.renderProgress}%` : "—"}</p>
            <p className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold">
              <Loader2 className="size-4 animate-spin" /> {renderingShort?.renderProgress ? "Processando..." : "Aguardando o início do processamento..."}
            </p>
            <Progress className="mt-4" value={renderingShort?.renderProgress || 0} />
          </div>
          <div className="rounded-xl border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">Pode fechar — o botão deste corte vira &quot;Baixar MP4&quot; quando terminar.</div>
          {renderingShort?.watermark ? (
            <div className="mt-3 rounded-xl border px-4 py-3 text-sm">
              <p className="text-muted-foreground">Este vídeo sai com a marca d&apos;água do Cortix. Assine e ela some de todos os seus vídeos — inclusive os já baixados.</p>
              <Button asChild variant="soft" size="sm" className="mt-2">
                <Link href="/financeiro?tab=plans">
                  <Sparkles /> Remover marca d&apos;água
                </Link>
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GenerationBox({ project }: { project: Project }) {
  const steps = [
    { label: "Vídeo recebido", done: ["transcribing", "analyzing", "generating", "ready"].includes(project.status) },
    { label: "Encontrando os melhores momentos", done: ["generating", "ready"].includes(project.status) },
    { label: "Montando e preparando os cortes", done: project.status === "ready" },
  ];
  return (
    <div className="mt-6 grid gap-6 rounded-3xl border bg-card p-6 md:grid-cols-2">
      <div>
        <p className="eyebrow flex items-center gap-2 !text-primary">
          <span className="pulse-dot size-2 rounded-full bg-primary" /> Geração em andamento
        </p>
        <h3 className="mt-3 text-2xl font-bold">Seu vídeo está virando cortes</h3>
        <p className="mt-2 text-sm text-muted-foreground">Analisamos o conteúdo e preparamos cada corte individualmente. Você não precisa atualizar a página: eles entram na lista assim que ficam prontos.</p>
        <ul className="mt-5 space-y-3">
          {steps.map((s, i) => {
            const active = !s.done && (i === 0 || steps[i - 1].done);
            return (
              <li key={s.label} className={cn("flex items-center gap-3 text-sm", s.done ? "text-foreground" : active ? "font-semibold" : "text-muted-foreground")}>
                <span className={cn("flex size-7 items-center justify-center rounded-full", s.done ? "bg-success/20 text-success" : active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
                  {s.done ? <Check className="size-4" /> : active ? <Loader2 className="size-4 animate-spin" /> : i + 1}
                </span>
                {s.label}
                {active && project.stage && project.status === "downloading" ? <span className="text-xs text-muted-foreground">({project.progress}%)</span> : null}
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Fila de cortes</span>
          <span className="text-xs text-muted-foreground">atualização automática</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {Array.from({ length: Math.min(3, project.targetClips || 3) }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="relative aspect-[9/16] rounded-xl bg-muted">
                <span className="absolute left-2 top-2 rounded bg-background/80 px-1.5 font-mono text-[10px]">{i + 1}</span>
                <div className="skeleton absolute inset-0 rounded-xl opacity-50" />
              </div>
              <div className="skeleton h-2 w-3/4 rounded" />
              <div className="skeleton h-2 w-1/2 rounded" />
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">O primeiro corte aparece aqui assim que estiver pronto.</p>
      </div>
    </div>
  );
}

function ClipCard({ short: s, projectId, onRender, onDelete, rendering, isSubscriber }: { short: Short; projectId: string; onRender: () => void; onDelete: () => void; rendering: boolean; isSubscriber: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const dur = s.endTime - s.startTime;
  const isRendering = s.status === "rendering";
  const rendered = s.status === "rendered" && s.renderUrl;
  const src = s.renderUrl || s.previewUrl;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onT = () => setT(v.currentTime);
    const onEnd = () => setPlaying(false);
    v.addEventListener("timeupdate", onT);
    v.addEventListener("ended", onEnd);
    return () => {
      v.removeEventListener("timeupdate", onT);
      v.removeEventListener("ended", onEnd);
    };
  }, [src]);

  function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="relative aspect-[9/16] bg-black" onClick={toggle}>
        {src ? <video ref={videoRef} src={src} poster={s.thumbnailUrl || undefined} className="size-full object-contain" playsInline preload="metadata" /> : s.thumbnailUrl ? <img src={s.thumbnailUrl} alt="" className="size-full object-cover" /> : null}
        <span className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-0.5 font-mono text-[11px] text-white">
          {formatClock(s.startTime)} ~ {formatClock(s.endTime)}
        </span>
        <span className="absolute bottom-16 right-2 rounded-lg bg-black/60 px-2 py-1 text-2xl font-black text-primary-foreground [text-shadow:0_2px_8px_var(--primary)]">{s.score.toFixed(1)}</span>
        {!rendered ? <span className="absolute bottom-16 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/80">Prévia em baixa resolução</span> : null}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 pb-2 pt-6" onClick={(e) => e.stopPropagation()}>
          <div className="relative h-1 rounded-full bg-white/30">
            <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${(t / Math.max(1, dur)) * 100}%` }} />
            <span className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-primary" style={{ left: `calc(${(t / Math.max(1, dur)) * 100}% - 6px)` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-white">
            <button onClick={toggle} className="p-1">
              {playing ? "❚❚" : <Play className="size-4 fill-current" />}
            </button>
            <span className="font-mono text-xs">
              {Math.floor(t)}s / {Math.round(dur)}s
            </span>
            <button onClick={() => setExpanded(true)} className="p-1">
              <Maximize2 className="size-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between border-b px-3 py-2 text-muted-foreground">
        <button title="Baixar" onClick={rendered ? undefined : onRender} className="rounded p-1 hover:bg-secondary hover:text-foreground">
          {rendered ? (
            <a href={`${s.renderUrl}?download=${encodeURIComponent(s.title)}.mp4`}>
              <Download className="size-4" />
            </a>
          ) : isRendering ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : (
            <Download className="size-4" />
          )}
        </button>
        <Link href={`/launcher?add=${s.id}`} title="Adicionar a um launcher" className="rounded p-1 hover:bg-secondary hover:text-foreground">
          <Rocket className="size-4" />
        </Link>
        <Link href={`/projects/${projectId}/editor/${s.id}`} title="Editar" className="rounded p-1 hover:bg-secondary hover:text-foreground">
          <Scissors className="size-4" />
        </Link>
        <Link href={`/schedule?short=${s.id}`} title="Agendar" className="rounded p-1 hover:bg-secondary hover:text-foreground">
          <Calendar className="size-4" />
        </Link>
        <button title="Excluir" onClick={onDelete} className="rounded p-1 hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-base font-semibold leading-snug">{s.title}</p>
        {rendered ? (
          <Badge variant="success" className="mt-2">
            Renderizado
          </Badge>
        ) : null}
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{s.reason}</p>
        {rendered ? (
          <Button asChild className="mt-3 w-full">
            <a href={`${s.renderUrl}?download=${encodeURIComponent(s.title)}.mp4`}>
              <Download /> Baixar MP4
            </a>
          </Button>
        ) : (
          <Button className="mt-3 w-full" onClick={onRender} disabled={isRendering || rendering}>
            {isRendering ? (
              <>
                <Loader2 className="animate-spin" /> Preparando seu vídeo... {s.renderProgress}%
              </>
            ) : (
              <>
                <Download /> Baixar clipe
              </>
            )}
          </Button>
        )}
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">Clique aqui pra salvar o vídeo no seu celular ou computador</p>
      </div>
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-md bg-black p-2" hideClose>
          {src ? <video src={src} controls autoPlay className="max-h-[80vh] w-full rounded-xl" /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BulkEditor({ projectId, shorts, onDone }: { projectId: string; shorts: Short[]; onDone: () => void }) {
  const [layout, setLayout] = useState("");
  const [loading, setLoading] = useState(false);
  async function apply() {
    setLoading(true);
    try {
      await Promise.all(shorts.map((s) => api(`/api/v1/shorts/${s.id}`, { method: "PATCH", json: layout ? { layout } : {} })));
      toast.success("Alterações aplicadas em todos os cortes");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Aplique alterações a todos os {shorts.length} cortes do projeto {projectId.slice(-4).toUpperCase()}.</p>
      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Layout</p>
        <NativeSelect value={layout} onChange={(e) => setLayout(e.target.value)} className="w-full">
          <option value="">Manter atual</option>
          <option value="single">Single</option>
          <option value="center">Center</option>
          <option value="split">Split</option>
          <option value="react">React</option>
        </NativeSelect>
      </div>
      <Button className="w-full" onClick={apply} loading={loading}>
        Aplicar em todos
      </Button>
    </div>
  );
}
