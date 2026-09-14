"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Download, Keyboard, Languages, LifeBuoy, Loader2, Monitor, MoreVertical, Pencil, Redo2, RotateCcw, Save, Server, Sparkles, SunMoon, Undo2, Upload, Rocket, Crown, Film } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api } from "@/lib/hooks";
import { Logo } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Paywall } from "@/components/page-header";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tip, ToolButton } from "./menu";
import { SHORTCUTS } from "./constants";
import type { ShortRecord } from "./types";

export interface TopBarProps {
  projectId: string;
  shortId: string;
  short: ShortRecord;
  title: string;
  onTitle: (t: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  dirty: boolean;
  saving: boolean;
  onSave: () => Promise<boolean>;
  onUpload: (files: FileList) => void;
  isSubscriber: boolean;
  onAutoEdit: () => void;
  imax: boolean;
  onImax: (v: boolean) => void;
  onReset: () => void;
  onLeave: (href: string) => void;
  onShortUpdate: (s: Partial<ShortRecord>) => void;
}

export function TopBar(p: TopBarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [serverOpen, setServerOpen] = useState(false);
  const [localOpen, setLocalOpen] = useState(false);
  const [resolution, setResolution] = useState<"1080x1920" | "720x1280">("1080x1920");
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState<{ status: string; progress: number; renderUrl: string | null }>({ status: p.short.status, progress: p.short.renderProgress, renderUrl: p.short.renderUrl });

  // polling do render
  useEffect(() => {
    if (!rendering) return;
    let alive = true;
    const t = setInterval(async () => {
      try {
        const d = await api<{ short: ShortRecord }>(`/api/v1/shorts/${p.shortId}`);
        if (!alive) return;
        setProgress({ status: d.short.status, progress: d.short.renderProgress, renderUrl: d.short.renderUrl });
        if (d.short.status === "rendered" || d.short.status === "failed") {
          setRendering(false);
          p.onShortUpdate({ status: d.short.status, renderUrl: d.short.renderUrl, renderProgress: d.short.renderProgress, previewUrl: d.short.previewUrl });
          if (d.short.status === "failed") toast.error("A renderização falhou. Tente novamente.");
        }
      } catch {}
    }, 1500);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendering, p.shortId]);

  async function startServerRender() {
    const okSave = await p.onSave();
    if (!okSave) return;
    try {
      setProgress({ status: "rendering", progress: 0, renderUrl: null });
      setRendering(true);
      await api(`/api/v1/shorts/${p.shortId}/render`, { method: "POST", json: { resolution } });
    } catch (e) {
      setRendering(false);
      toast.error((e as Error).message);
    }
  }

  const downloadName = `${p.title || "corte"}.mp4`;
  const localSrc = p.short.renderUrl || p.short.previewUrl;

  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b bg-[#0f0f11] px-3">
      <Tip label="Voltar aos projetos">
        <button type="button" onClick={() => p.onLeave(`/projects/${p.projectId}`)} className="mr-1 flex items-center rounded-md px-1 hover:bg-secondary cursor-pointer">
          <Logo className="[&>span:last-child]:hidden" />
        </button>
      </Tip>
      <ToolButton onClick={() => fileRef.current?.click()}>
        <Upload /> Uploads
      </ToolButton>
      <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && p.onUpload(e.target.files)} />
      <Sep />
      <Tip label="Desfazer (Ctrl+Z)">
        <ToolButton onClick={p.onUndo} disabled={!p.canUndo}>
          <Undo2 />
        </ToolButton>
      </Tip>
      <Tip label="Refazer (Ctrl+Y)">
        <ToolButton onClick={p.onRedo} disabled={!p.canRedo}>
          <Redo2 />
        </ToolButton>
      </Tip>
      <Sep />
      <ToolButton onClick={() => p.onSave()} disabled={p.saving || !p.dirty} className={cn(p.dirty && "text-foreground")}>
        {p.saving ? <Loader2 className="animate-spin" /> : <Save />} Salvar
      </ToolButton>
      <span className={cn("flex items-center gap-1 text-[11px]", p.dirty ? "text-warning" : "text-muted-foreground")}>
        {p.dirty ? <span className="size-1.5 rounded-full bg-warning" /> : <Check className="size-3 text-success" />}
        {p.dirty ? "Alterações não salvas" : "Salvo"}
      </span>
      <Sep />
      <div className="flex min-w-0 items-center gap-1">
        {editing ? (
          <input
            autoFocus
            defaultValue={p.title}
            onBlur={(e) => {
              setEditing(false);
              if (e.target.value.trim()) p.onTitle(e.target.value.trim());
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditing(false);
            }}
            className="h-8 w-64 rounded-md border bg-background px-2 text-sm font-semibold outline-none focus:border-primary"
          />
        ) : (
          <span className="max-w-64 truncate text-sm font-semibold" title={p.title}>
            {p.title}
          </span>
        )}
        <button type="button" onClick={() => setEditing(true)} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Renomear">
          <Pencil className="size-3.5" />
        </button>
      </div>

      <div className="flex-1" />

      <Tip label="Auto Edit: aplica layout Single e reagrupa as legendas">
        <ToolButton onClick={() => (p.isSubscriber ? p.onAutoEdit() : setPaywall(true))} className="text-foreground">
          <Sparkles className="text-primary" /> Auto Edit <span className="rounded bg-primary/20 px-1 text-[9px] font-bold text-primary">PRO</span>
        </ToolButton>
      </Tip>
      <Tip label="IMAX Mode: prévia maior">
        <ToolButton active={p.imax} onClick={() => p.onImax(!p.imax)}>
          <Film /> IMAX Mode
        </ToolButton>
      </Tip>
      <ToolButton>
        <Languages /> <span className="text-[10px]">BR</span> PT
      </ToolButton>
      <Tip label="Adicionar ao launcher">
        <Link href={`/launcher?add=${p.shortId}`} className="inline-flex h-8 items-center rounded-md px-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <Rocket className="size-4" />
        </Link>
      </Tip>
      <Tip label="Suporte">
        <Link href="/forum" className="inline-flex h-8 items-center rounded-md px-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <LifeBuoy className="size-4" />
        </Link>
      </Tip>
      <Tip label="Atalhos do teclado">
        <ToolButton onClick={() => setShortcuts(true)}>
          <Keyboard />
        </ToolButton>
      </Tip>
      <Menu>
        <MenuTrigger asChild>
          <ToolButton>
            <MoreVertical />
          </ToolButton>
        </MenuTrigger>
        <MenuContent align="end">
          <MenuItem
            onSelect={() => {
              if (confirm("Resetar a timeline? Todas as alterações locais serão descartadas.")) p.onReset();
            }}
          >
            <RotateCcw /> Resetar Timeline
          </MenuItem>
          <MenuSeparator />
          <MenuItem onSelect={() => setShortcuts(true)}>
            <Keyboard /> Atalhos do teclado
          </MenuItem>
        </MenuContent>
      </Menu>
      <Tip label="Alternar tema">
        <ToolButton onClick={() => document.documentElement.classList.toggle("dark")}>
          <SunMoon />
        </ToolButton>
      </Tip>

      <Menu>
        <MenuTrigger asChild>
          <Button size="sm" className="ml-1 h-9 rounded-lg px-4">
            <Download /> Exportar <ChevronDown className="!size-3.5 opacity-70" />
          </Button>
        </MenuTrigger>
        <MenuContent align="end" className="w-[340px] p-2">
          <div className="rounded-lg bg-secondary/60 p-3">
            <p className="text-sm font-semibold">Seu vídeo final</p>
            <p className="text-xs text-muted-foreground">1080 × 1920 — Com as legendas, cortes e elementos da sua edição.</p>
          </div>
          <MenuItem className="mt-2 items-start py-2.5" onSelect={() => setServerOpen(true)}>
            <Server className="mt-0.5 size-4 text-primary" />
            <span>
              <span className="block font-medium">Gerar no servidor</span>
              <span className="block text-[11px] leading-snug text-muted-foreground">O Cortix processa o vídeo. Confirme as condições na próxima etapa.</span>
            </span>
          </MenuItem>
          <MenuItem className="items-start py-2.5" onSelect={() => setLocalOpen(true)}>
            <Monitor className="mt-0.5 size-4 text-primary" />
            <span>
              <span className="block font-medium">Gerar neste computador</span>
              <span className="block text-[11px] leading-snug text-muted-foreground">Escolha a resolução e mantenha esta página aberta até terminar. Apenas Chrome/Firefox/Safari.</span>
            </span>
          </MenuItem>
        </MenuContent>
      </Menu>

      {/* paywall Auto Edit */}
      <Dialog open={paywall} onOpenChange={setPaywall}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="size-5 text-primary" /> Auto Edit é PRO
            </DialogTitle>
          </DialogHeader>
          <Paywall title="Recurso exclusivo para assinantes" description="O Auto Edit aplica o melhor layout e reagrupa as legendas automaticamente. Assine um plano para desbloquear." />
        </DialogContent>
      </Dialog>

      {/* atalhos */}
      <Dialog open={shortcuts} onOpenChange={setShortcuts}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atalhos do teclado</DialogTitle>
            <DialogDescription>Funcionam quando o foco não está em um campo de texto.</DialogDescription>
          </DialogHeader>
          <ul className="divide-y">
            {SHORTCUTS.map(([k, d]) => (
              <li key={k} className="flex items-center justify-between py-2 text-sm">
                <span className="text-muted-foreground">{d}</span>
                <kbd className="rounded-md border bg-secondary px-2 py-0.5 font-mono text-xs">{k}</kbd>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      {/* gerar no servidor */}
      <Dialog open={serverOpen} onOpenChange={setServerOpen}>
        <DialogContent>
          {rendering || progress.status === "rendering" ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">🎬 Gerando Vídeo</DialogTitle>
                <DialogDescription>Preparando seu corte… pronto em até 30 segundos. Legendas e enquadramento já vão embutidos.</DialogDescription>
              </DialogHeader>
              <div className="py-4 text-center">
                <p className="text-6xl font-black text-primary">{progress.progress ? `${progress.progress}%` : "—"}</p>
                <p className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold">
                  <Loader2 className="size-4 animate-spin" /> {progress.progress ? "Processando..." : "Aguardando o início do processamento..."}
                </p>
                <Progress className="mt-4" value={progress.progress || 0} />
              </div>
              <div className="rounded-xl border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">Pode fechar — o vídeo continua sendo gerado no servidor.</div>
            </>
          ) : progress.status === "rendered" && progress.renderUrl ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Check className="size-5 text-success" /> Vídeo pronto
                </DialogTitle>
                <DialogDescription>Seu corte foi renderizado em {resolution.replace("x", " × ")}.</DialogDescription>
              </DialogHeader>
              <video src={progress.renderUrl} controls className="max-h-72 w-full rounded-xl bg-black" />
              <DialogFooter>
                <Button variant="secondary" onClick={() => setProgress({ status: "ready", progress: 0, renderUrl: progress.renderUrl })}>
                  Gerar novamente
                </Button>
                <Button asChild>
                  <a href={`${progress.renderUrl}?download=${encodeURIComponent(downloadName)}`}>
                    <Download /> Baixar MP4
                  </a>
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Gerar no servidor</DialogTitle>
                <DialogDescription>Confirme as condições antes de renderizar.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Resolução</span>
                  <NativeSelect value={resolution} onChange={(e) => setResolution(e.target.value as typeof resolution)} className="w-full">
                    <option value="1080x1920">1080 × 1920 (Full HD)</option>
                    <option value="720x1280">720 × 1280 (HD)</option>
                  </NativeSelect>
                </div>
                <ul className="space-y-1.5 rounded-xl border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
                  <li>• As alterações não salvas serão salvas antes de renderizar.</li>
                  <li>• Legendas, layout e hook são embutidos no vídeo final.</li>
                  {!p.isSubscriber && p.short.project.isFree ? <li>• Este vídeo sai com a marca d&apos;água do Cortix. Assine para removê-la.</li> : null}
                  <li>• Elementos e filtros da prévia ainda não são aplicados na renderização.</li>
                </ul>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setServerOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={startServerRender}>
                  <Server /> Gerar vídeo
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* gerar neste computador */}
      <Dialog open={localOpen} onOpenChange={setLocalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar neste computador</DialogTitle>
            <DialogDescription>Escolha a resolução e mantenha esta página aberta até terminar. Apenas Chrome/Firefox/Safari.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <NativeSelect value={resolution} onChange={(e) => setResolution(e.target.value as typeof resolution)} className="w-full">
              <option value="1080x1920">1080 × 1920 (Full HD)</option>
              <option value="720x1280">720 × 1280 (HD)</option>
            </NativeSelect>
            {!p.short.renderUrl ? (
              <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-xs">Ainda não existe uma renderização deste corte. O arquivo baixado será a <b>prévia em baixa resolução</b>. Para o vídeo final em {resolution.replace("x", " × ")}, use &quot;Gerar no servidor&quot;.</p>
            ) : (
              <p className="rounded-xl border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">Será baixada a última renderização salva deste corte.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setLocalOpen(false)}>
              Cancelar
            </Button>
            {localSrc ? (
              <Button asChild onClick={() => setLocalOpen(false)}>
                <a href={`${localSrc}?download=${encodeURIComponent(downloadName)}`}>
                  <Download /> Baixar {p.short.renderUrl ? "MP4" : "prévia"}
                </a>
              </Button>
            ) : (
              <Button disabled>Nenhum vídeo disponível</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}

function Sep() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" />;
}
