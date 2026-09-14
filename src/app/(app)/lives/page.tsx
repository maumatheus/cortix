"use client";

import Link from "next/link";
import { useState } from "react";
import { Coins, ExternalLink, Info, Pencil, Play, Plus, Radio, Square, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, useFetch, useUser } from "@/lib/hooks";
import { cn, timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/page-header";
import { EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonitorDialog, type LiveMonitorItem } from "@/components/lives/monitor-dialog";

interface Resp {
  data: LiveMonitorItem[];
  stats: { liveNow: number; channels: number; clipsTotal: number; clipsLast7d: number };
  credits: number;
}

const STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  idle: { label: "Parado", cls: "text-muted-foreground", dot: "bg-muted-foreground" },
  watching: { label: "Observando", cls: "text-sky-400", dot: "bg-sky-400 pulse-dot" },
  live: { label: "Ao vivo", cls: "text-destructive", dot: "bg-destructive pulse-dot" },
  stopped: { label: "Encerrado", cls: "text-muted-foreground", dot: "bg-muted-foreground" },
};

export default function LivesPage() {
  const { user } = useUser();
  const mine = useFetch<Resp>("/api/v1/lives?scope=mine", { refreshMs: 10000 });
  const pub = useFetch<Resp>("/api/v1/lives?scope=public", { refreshMs: 30000 });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LiveMonitorItem | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const stats = mine.data?.stats;

  async function toggle(m: LiveMonitorItem) {
    setToggling(m.id);
    try {
      const r = await api<{ monitor: LiveMonitorItem; detected: boolean | null }>(`/api/v1/lives/${m.id}/toggle`, { method: "POST" });
      if (r.monitor.status === "live") toast.success("Canal ao vivo agora! Monitorando.");
      else if (r.monitor.status === "watching") toast.success(r.detected === false ? "Canal offline. Vou avisar quando entrar ao vivo." : "Monitoramento iniciado.");
      else toast.success("Monitoramento parado");
      mine.reload();
      pub.reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setToggling(null);
    }
  }

  async function remove(m: LiveMonitorItem) {
    if (!confirm(`Excluir o monitoramento "${m.name}"?`)) return;
    try {
      await api(`/api/v1/lives/${m.id}`, { method: "DELETE" });
      toast.success("Monitoramento excluído");
      mine.reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Page wide>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <span className={cn("size-1.5 rounded-full", stats?.liveNow ? "bg-destructive pulse-dot" : "bg-success")} /> {stats?.liveNow ?? 0} ao vivo agora / Seus canais e seus cortes desde que você começou a monitorar
          </p>
          <h1 className="mt-3 text-4xl font-black leading-[0.95] tracking-tight md:text-5xl">
            Monitoramento <span className="font-serif font-medium italic text-muted-foreground">de Lives.</span>
          </h1>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:max-w-md">
            <div className="rounded-2xl border bg-card p-5">
              <p className="eyebrow">Ao vivo</p>
              <p className={cn("mt-2 font-mono text-5xl font-black", stats?.liveNow ? "text-destructive" : "")}>{stats?.liveNow ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">de {stats?.channels ?? 0} canais monitorados</p>
            </div>
            <div className="rounded-2xl border bg-card p-5">
              <p className="eyebrow">Cortes · últimos 7 dias</p>
              <p className="mt-2 font-mono text-5xl font-black">{stats?.clipsLast7d ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stats?.clipsTotal ?? 0} no total</p>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus /> Criar monitoramento
          </Button>
          <div className="flex gap-3 rounded-2xl border bg-card p-5">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="text-sm">
              <p className="font-semibold">Como funciona o monitoramento</p>
              <p className="mt-1 text-xs text-muted-foreground">A IA acompanha a transmissão e cria somente os melhores momentos que atingem a nota mínima. Cada clipe gerado custa 1 crédito.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Coins className="size-5" />
            </div>
            <div className="flex-1">
              <p className="eyebrow !text-primary">Saldo disponível</p>
              <p className="text-xs text-muted-foreground">Créditos disponíveis para vídeo e monitoramento</p>
            </div>
            <p className="font-mono text-xl font-bold">{user?.credits ?? mine.data?.credits ?? 0} <span className="text-xs font-normal text-muted-foreground">créditos</span></p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="mine" className="mt-8">
        <TabsList>
          <TabsTrigger value="mine">Meus Monitoramentos</TabsTrigger>
          <TabsTrigger value="public">Lives Públicas</TabsTrigger>
        </TabsList>
        <TabsContent value="mine">
          {mine.loading && !mine.data ? (
            <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-40" />)}</div>
          ) : (mine.data?.data.length ?? 0) === 0 ? (
            <EmptyState
              icon={<Radio />}
              title="Nenhum monitoramento criado"
              description="Crie um monitoramento para acompanhar lives com seu prompt personalizado"
              action={
                <Button
                  onClick={() => {
                    setEditing(null);
                    setOpen(true);
                  }}
                >
                  <Plus /> Criar monitoramento
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {mine.data!.data.map((m) => (
                <MonitorCard
                  key={m.id}
                  m={m}
                  toggling={toggling === m.id}
                  onToggle={() => toggle(m)}
                  onEdit={() => {
                    setEditing(m);
                    setOpen(true);
                  }}
                  onDelete={() => remove(m)}
                />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="public">
          {(pub.data?.data.length ?? 0) === 0 ? (
            <EmptyState icon={<Radio />} title="Nenhuma live pública no ar" description="Quando canais monitorados pela comunidade entrarem ao vivo, eles aparecem aqui." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {pub.data!.data.map((m) => (
                <MonitorCard key={m.id} m={m} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <MonitorDialog open={open} onOpenChange={setOpen} monitor={editing} onSaved={mine.reload} />
    </Page>
  );
}

function MonitorCard({ m, toggling, onToggle, onEdit, onDelete }: { m: LiveMonitorItem; toggling?: boolean; onToggle?: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const s = STATUS[m.status] ?? STATUS.idle;
  const running = m.status === "watching" || m.status === "live";
  return (
    <div className={cn("flex flex-col rounded-2xl border bg-card p-5", m.status === "live" && "border-destructive/50 shadow-[0_0_0_1px_var(--destructive)]")}>
      <div className="flex items-start gap-3">
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", m.status === "live" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary")}>
          <Radio className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{m.name}</p>
          <a href={m.channelUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground">
            {m.channelUrl.replace(/^https?:\/\/(www\.)?/, "")} <ExternalLink className="size-3 shrink-0" />
          </a>
        </div>
        <span className={cn("flex items-center gap-1.5 font-mono text-[10px] uppercase", s.cls)}>
          <span className={cn("size-1.5 rounded-full", s.dot)} /> {s.label}
        </span>
      </div>
      {m.prompt ? <p className="mt-3 line-clamp-2 rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">&ldquo;{m.prompt}&rdquo;</p> : null}
      <div className="mt-3 flex items-center gap-4 font-mono text-[11px] text-muted-foreground">
        <span>
          Nota mín. <span className="text-foreground">{m.minScore}</span>
        </span>
        <span>
          Cortes <span className="text-foreground">{m.clipsCount}</span>
        </span>
        <span className="ml-auto">{m.isMine ? `há ${timeAgo(m.createdAt)}` : `por ${m.author}`}</span>
      </div>
      {onToggle ? (
        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" variant={running ? "secondary" : "default"} className="flex-1" onClick={onToggle} disabled={toggling}>
            {toggling ? <Loader2 className="animate-spin" /> : running ? <Square /> : <Play />}
            {running ? "Parar" : "Iniciar monitoramento"}
          </Button>
          {onEdit ? (
            <button className="rounded-md border p-2 hover:bg-secondary" title="Editar" onClick={onEdit}>
              <Pencil className="size-4" />
            </button>
          ) : null}
          {onDelete ? (
            <button className="rounded-md border p-2 text-destructive hover:bg-destructive/10" title="Excluir" onClick={onDelete}>
              <Trash2 className="size-4" />
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-4">
          <Button asChild size="sm" variant="secondary" className="w-full">
            <Link href={`/criar-projeto?url=${encodeURIComponent(m.channelUrl)}`}>Criar cortes dessa live</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
