"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PLATFORMS, PlatformDot, type PlatformId } from "@/components/shared/platform";
import { ShortPicker } from "@/components/shared/short-picker";

export interface LauncherItemRow {
  id: string;
  shortId: string;
  position: number;
  status: "queued" | "scheduled" | "posted";
  postAt: string | null;
  short: { id: string; title: string; thumbnailUrl: string | null; renderUrl: string | null; status: string; projectId: string; project: { title: string } };
}

export interface LauncherRow {
  id: string;
  name: string;
  platforms: PlatformId[];
  times: string[];
  status: "active" | "paused";
  createdAt: string;
  items: LauncherItemRow[];
  queuedCount: number;
  postedCount: number;
  nextPostAt: string | null;
}

export function LauncherDialog({ open, onOpenChange, launcher, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; launcher?: LauncherRow | null; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [platforms, setPlatforms] = useState<PlatformId[]>(["youtube"]);
  const [times, setTimes] = useState<string[]>(["09:00", "18:00"]);
  const [newTime, setNewTime] = useState("12:00");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(launcher?.name ?? "");
    setPlatforms(launcher?.platforms?.length ? launcher.platforms : ["youtube"]);
    setTimes(launcher?.times?.length ? launcher.times : ["09:00", "18:00"]);
    setNewTime("12:00");
  }, [open, launcher]);

  function togglePlatform(p: PlatformId) {
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }
  function addTime() {
    if (!/^\d{2}:\d{2}$/.test(newTime)) return;
    if (times.includes(newTime)) return toast.error("Esse horário já está na lista");
    if (times.length >= 12) return toast.error("Máximo de 12 horários");
    setTimes([...times, newTime].sort());
  }

  async function save() {
    if (!name.trim()) return toast.error("Dê um nome ao launcher");
    if (!platforms.length) return toast.error("Escolha pelo menos uma rede");
    if (!times.length) return toast.error("Adicione pelo menos um horário");
    setLoading(true);
    try {
      const payload = { name: name.trim(), platforms, times };
      if (launcher) await api(`/api/v1/launchers/${launcher.id}`, { method: "PATCH", json: payload });
      else await api("/api/v1/launchers", { method: "POST", json: payload });
      toast.success(launcher ? "Launcher atualizado" : "Launcher criado");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{launcher ? "Editar launcher" : "Novo launcher"}</DialogTitle>
          <DialogDescription>Defina as redes e os horários. Os clipes da fila saem automaticamente, um por horário.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Cortes diários do podcast" className="mt-1" autoFocus />
          </div>
          <div>
            <Label>Redes</Label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {PLATFORMS.map((p) => {
                const on = platforms.includes(p.id);
                return (
                  <button key={p.id} type="button" onClick={() => togglePlatform(p.id)} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition", on ? "border-primary bg-primary/10" : "hover:bg-secondary/60")}>
                    <span className={cn("flex size-4 items-center justify-center rounded border text-[10px]", on ? "border-primary bg-primary text-white" : "border-muted-foreground/40")}>{on ? "✓" : ""}</span>
                    <PlatformDot platform={p.id} size="sm" /> {p.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label>Horários de postagem</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {times.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-md border bg-secondary/50 px-2 py-1 font-mono text-xs">
                  {t}
                  <button type="button" onClick={() => setTimes(times.filter((x) => x !== t))} className="text-muted-foreground hover:text-destructive">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {!times.length ? <span className="text-xs text-muted-foreground">Nenhum horário</span> : null}
            </div>
            <div className="mt-2 flex gap-2">
              <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-36 font-mono" />
              <Button type="button" variant="secondary" onClick={addTime}>
                <Plus /> Adicionar horário
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} loading={loading}>
            {launcher ? "Salvar" : "Criar launcher"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Adicionar clipe(s) à fila.
 * - Com `launcherId` fixo: escolhe os cortes.
 * - Com `shortId` fixo (?add=ID): escolhe o launcher de destino.
 */
export function AddClipDialog({ open, onOpenChange, launchers, launcherId, shortId, onSaved, onCreateLauncher }: { open: boolean; onOpenChange: (v: boolean) => void; launchers: LauncherRow[]; launcherId?: string | null; shortId?: string | null; onSaved: () => void; onCreateLauncher?: () => void }) {
  const [target, setTarget] = useState("");
  const [shortIds, setShortIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTarget(launcherId ?? launchers[0]?.id ?? "");
    setShortIds(shortId ? [shortId] : []);
  }, [open, launcherId, shortId, launchers]);

  async function save() {
    if (!target) return toast.error("Escolha um launcher");
    if (!shortIds.length) return toast.error("Selecione pelo menos um corte");
    setLoading(true);
    try {
      const r = await api<{ added: number }>(`/api/v1/launchers/${target}/items`, { method: "POST", json: { shortIds } });
      toast.success(r.added ? `${r.added} clipe${r.added > 1 ? "s" : ""} na fila` : "Esse clipe já estava na fila");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar clipe ao launcher</DialogTitle>
          <DialogDescription>O Cortix encaixa cada clipe no próximo horário livre da fila.</DialogDescription>
        </DialogHeader>
        <div className="scrollbar-thin max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {!launcherId ? (
            <div>
              <Label>Launcher de destino</Label>
              {launchers.length === 0 ? (
                <div className="mt-1 flex items-center justify-between rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
                  Você ainda não tem launchers.
                  {onCreateLauncher ? (
                    <Button size="sm" variant="secondary" onClick={onCreateLauncher}>
                      Criar launcher
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  {launchers.map((l) => (
                    <button key={l.id} type="button" onClick={() => setTarget(l.id)} className={cn("flex items-center gap-3 rounded-xl border p-3 text-left transition", target === l.id ? "border-primary bg-primary/10" : "hover:bg-secondary/60")}>
                      <div className="flex -space-x-1">
                        {l.platforms.map((p) => (
                          <PlatformDot key={p} platform={p} size="sm" className="ring-2 ring-card" />
                        ))}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{l.name}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {l.times.join(" · ")} · {l.queuedCount} na fila
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          {shortId ? (
            <p className="rounded-lg border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
              Corte pré-selecionado: <span className="font-mono text-foreground">{shortId.slice(-6).toUpperCase()}</span>. Você pode marcar mais cortes abaixo.
            </p>
          ) : null}
          <ShortPicker multiple selected={shortIds} onChange={(ids) => setShortIds(ids)} preselectedId={shortId} />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} loading={loading} disabled={!target || !shortIds.length}>
            Adicionar {shortIds.length ? `${shortIds.length} clipe${shortIds.length > 1 ? "s" : ""}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
