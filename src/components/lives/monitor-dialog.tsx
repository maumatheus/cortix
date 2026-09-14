"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface LiveMonitorItem {
  id: string;
  name: string;
  channelUrl: string;
  prompt: string;
  minScore: number;
  status: "idle" | "watching" | "live" | "stopped";
  clipsCount: number;
  createdAt: string;
  isMine: boolean;
  author: string;
}

export function MonitorDialog({ open, onOpenChange, monitor, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; monitor?: LiveMonitorItem | null; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [channelUrl, setChannelUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [minScore, setMinScore] = useState(7);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(monitor?.name ?? "");
    setChannelUrl(monitor?.channelUrl ?? "");
    setPrompt(monitor?.prompt ?? "");
    setMinScore(monitor?.minScore ?? 7);
  }, [open, monitor]);

  async function save() {
    if (!name.trim() || !channelUrl.trim()) return toast.error("Preencha nome e URL do canal");
    setLoading(true);
    try {
      const payload = { name: name.trim(), channelUrl: channelUrl.trim(), prompt: prompt.trim(), minScore };
      if (monitor) await api(`/api/v1/lives/${monitor.id}`, { method: "PATCH", json: payload });
      else await api("/api/v1/lives", { method: "POST", json: payload });
      toast.success(monitor ? "Monitoramento atualizado" : "Monitoramento criado");
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{monitor ? "Editar monitoramento" : "Criar monitoramento"}</DialogTitle>
          <DialogDescription>A IA acompanha a live e gera cortes dos momentos que batem sua nota mínima.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Live do Casimiro" className="mt-1" autoFocus />
          </div>
          <div>
            <Label>URL do canal ou da live</Label>
            <Input value={channelUrl} onChange={(e) => setChannelUrl(e.target.value)} placeholder="https://www.youtube.com/@canal ou https://twitch.tv/canal" className="mt-1" />
            <p className="mt-1 text-[11px] text-muted-foreground">No YouTube, a detecção de &ldquo;ao vivo&rdquo; é automática. Outras plataformas ficam em observação.</p>
          </div>
          <div>
            <Label>Prompt</Label>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Descreva o que a IA deve procurar" className="mt-1 min-h-24" maxLength={2000} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Nota mínima</Label>
              <span className="font-mono text-sm font-bold text-primary">{minScore}/10</span>
            </div>
            <input type="range" min={1} max={10} step={1} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="mt-2 w-full accent-[var(--primary)]" />
            <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>1 · mais clipes</span>
              <span>10 · só o melhor</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} loading={loading}>
            {monitor ? "Salvar" : "Criar monitoramento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
