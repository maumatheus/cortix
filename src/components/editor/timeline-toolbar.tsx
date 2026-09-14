"use client";

import { forwardRef, useMemo, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Expand, Frame, LayoutGrid, Link2, Magnet, Maximize, Merge, Repeat, Scissors, Sparkles, Wand2, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LAYOUTS } from "@/lib/caption-styles";
import { toSentences, type CaptionGroup, type Word } from "@/lib/video/transcript";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, Tip, ToolButton } from "./menu";
import { GUIDES, RATIOS } from "./constants";
import { fmtRuler, groupText } from "./captions";
import type { GuideId } from "./types";
import type { Player } from "./use-player";

export interface TimelineToolbarProps {
  player: Player;
  words: Word[];
  startTime: number;
  endTime: number;
  durationSec: number;
  captions: CaptionGroup[];
  faceMotion: Record<string, boolean>;
  layout: string;
  applyAll: boolean;
  guide: GuideId;
  magnet: boolean;
  zoom: number;
  onSplit: () => void;
  onMerge: () => void;
  onGlue: () => void;
  onMagnet: (v: boolean) => void;
  onExpand: () => void;
  onExtendRange: (start: number, end: number) => void;
  onToggleMotion: (i: number) => void;
  onGuide: (g: GuideId) => void;
  onLayout: (id: string) => void;
  onApplyAll: (v: boolean) => void;
  onViewWhole: () => void;
  onFitSelection: () => void;
  onZoom: (z: number) => void;
}

export function TimelineToolbar(p: TimelineToolbarProps) {
  const [addOpen, setAddOpen] = useState(false);
  const motionOn = Object.values(p.faceMotion).filter(Boolean).length;
  const layoutName = LAYOUTS.find((l) => l.id === p.layout)?.name || p.layout;

  return (
    <div className="flex h-11 shrink-0 items-center gap-0.5 overflow-x-auto border-t bg-[#0f0f11] px-2 [scrollbar-width:none]">
      <Tip label="Cortar cena no cursor (S)">
        <ToolButton onClick={p.onSplit}>
          <Scissors />
        </ToolButton>
      </Tip>
      <Tip label="Juntar cenas (a selecionada com a seguinte)">
        <ToolButton onClick={p.onMerge}>
          <Merge />
        </ToolButton>
      </Tip>
      <Tip label="Colar cenas (fecha os espaços entre legendas)">
        <ToolButton onClick={p.onGlue}>
          <Link2 />
        </ToolButton>
      </Tip>
      <Tip label={p.magnet ? "Ímã ligado" : "Ímã (encaixar nas bordas)"}>
        <ToolButton active={p.magnet} onClick={() => p.onMagnet(!p.magnet)}>
          <Magnet />
        </ToolButton>
      </Tip>
      <Sep />

      <Menu>
        <Tip label="Ferramentas de IA">
          <MenuTriggerButton>
            <Wand2 /> Ferramentas IA <ChevronDown className="!size-3 opacity-60" />
          </MenuTriggerButton>
        </Tip>
        <MenuContent>
          <MenuItem onSelect={p.onExpand}>
            <Expand /> Expandir corte
            <span className="ml-auto text-[10px] text-muted-foreground">+3s / +3s</span>
          </MenuItem>
          <MenuItem onSelect={() => setAddOpen(true)}>
            <Sparkles /> Adicionar trecho da transcrição
          </MenuItem>
          <MenuSeparator />
          <Tip label="Em breve">
            <div>
              <MenuItem disabled>Remover silêncios</MenuItem>
            </div>
          </Tip>
          <Tip label="Em breve">
            <div>
              <MenuItem disabled>Separar áudio</MenuItem>
            </div>
          </Tip>
        </MenuContent>
      </Menu>

      <Menu>
        <Tip label="Motion: acompanhar rosto por cena">
          <MenuTriggerButton>
            Motion ({motionOn}/{p.captions.length}) <ChevronDown className="!size-3 opacity-60" />
          </MenuTriggerButton>
        </Tip>
        <MenuContent className="max-h-80 w-72 overflow-y-auto">
          <MenuLabel>Cenas</MenuLabel>
          {p.captions.length ? (
            p.captions.map((g, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs hover:bg-secondary">
                <span className="w-10 shrink-0 font-mono text-[10px] text-muted-foreground">{fmtRuler(Math.round((g.start - p.startTime) * 10) / 10)}</span>
                <span className="flex-1 truncate">{groupText(g) || "(sem texto)"}</span>
                <Switch checked={!!p.faceMotion[String(i)]} onCheckedChange={() => p.onToggleMotion(i)} className="h-4 w-7 [&>span]:size-3 [&>span]:data-[state=checked]:translate-x-3" />
              </div>
            ))
          ) : (
            <p className="px-2.5 py-2 text-xs text-muted-foreground">Nenhuma cena.</p>
          )}
        </MenuContent>
      </Menu>

      <Menu>
        <Tip label="Guia de layout (áreas cobertas pela interface)">
          <MenuTriggerButton>
            <Frame /> Guia de Layout <ChevronDown className="!size-3 opacity-60" />
          </MenuTriggerButton>
        </Tip>
        <MenuContent>
          {GUIDES.map((g) => (
            <MenuItem key={g.id} checked={p.guide === g.id} onSelect={() => p.onGuide(g.id)}>
              {g.label}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>

      <Menu>
        <Tip label="Canvas Ratio">
          <MenuTriggerButton>
            <Maximize /> 9:16 <ChevronDown className="!size-3 opacity-60" />
          </MenuTriggerButton>
        </Tip>
        <MenuContent>
          <MenuLabel>Canvas Ratio</MenuLabel>
          {RATIOS.map((r) => (
            <MenuItem key={r.id} disabled={!r.enabled} checked={r.enabled}>
              <span className="w-10 font-semibold">{r.label}</span>
              <span className="text-xs text-muted-foreground">{r.size}</span>
              {!r.enabled ? <span className="ml-auto rounded bg-secondary px-1.5 text-[10px]">Em breve</span> : null}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>

      <Tip label={p.player.loop ? "Repetição ligada" : "Repetir corte"}>
        <ToolButton active={p.player.loop} onClick={() => p.player.setLoop(!p.player.loop)}>
          <Repeat />
        </ToolButton>
      </Tip>
      <Tip label="BrainrotMAXXXING: preenche com brainrot todas as cenas que usam o layout Centro">
        <ToolButton onClick={() => toast("Em breve", { description: "BrainrotMAXXXING chega em breve." })} className="font-black tracking-widest text-fuchsia-400 hover:text-fuchsia-300">
          XXX
        </ToolButton>
      </Tip>
      <Sep />

      <Menu>
        <Tip label="Layout do vídeo">
          <MenuTriggerButton className="text-foreground">
            <LayoutGrid /> Layout do Vídeo: <b>{layoutName}</b> <ChevronDown className="!size-3 opacity-60" />
          </MenuTriggerButton>
        </Tip>
        <MenuContent className="w-64">
          <div className="flex items-center justify-between px-2.5 py-2 text-xs">
            <span>Aplicar em todas as cenas</span>
            <Switch checked={p.applyAll} onCheckedChange={p.onApplyAll} className="h-5 w-9 [&>span]:size-4 [&>span]:data-[state=checked]:translate-x-4" />
          </div>
          <MenuSeparator />
          <MenuLabel>Sugeridos</MenuLabel>
          {LAYOUTS.filter((l) => l.group === "sugeridos").map((l) => (
            <MenuItem key={l.id} checked={p.layout === l.id} onSelect={() => p.onLayout(l.id)}>
              <LayoutIcon id={l.id} />
              <span>
                <span className="block font-medium">{l.name}</span>
                <span className="block text-[11px] text-muted-foreground">{l.description}</span>
              </span>
            </MenuItem>
          ))}
          <MenuLabel>Avançados</MenuLabel>
          {LAYOUTS.filter((l) => l.group === "avancados").map((l) => (
            <MenuItem key={l.id} checked={p.layout === l.id} onSelect={() => p.onLayout(l.id)}>
              <LayoutIcon id={l.id} />
              <span>
                <span className="block font-medium">{l.name}</span>
                <span className="block text-[11px] text-muted-foreground">{l.description}</span>
              </span>
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>

      <div className="flex-1" />
      <ToolButton onClick={p.onViewWhole}>Ver projeto inteiro</ToolButton>
      <ToolButton onClick={p.onFitSelection}>Ajustar à seleção</ToolButton>
      <div className="ml-1 flex items-center gap-1.5 pr-1 text-muted-foreground">
        <ZoomIn className="size-3.5" />
        <input type="range" min={1} max={12} step={0.25} value={p.zoom} onChange={(e) => p.onZoom(Number(e.target.value))} className="h-1 w-24 cursor-pointer accent-[var(--primary)]" title="Zoom da timeline" />
      </div>

      <AddTranscriptDialog open={addOpen} onOpenChange={setAddOpen} words={p.words} startTime={p.startTime} endTime={p.endTime} durationSec={p.durationSec} onPick={p.onExtendRange} />
    </div>
  );
}

function Sep() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

/** Gatilho de menu com visual de ToolButton. Encaminha ref/props para o Tip (Slot) conseguir ancorar. */
const MenuTriggerButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(({ className, children, ...props }, ref) => (
  <DropdownMenu.Trigger asChild>
    <ToolButton ref={ref} className={cn("data-[state=open]:bg-secondary data-[state=open]:text-foreground", className)} {...props}>
      {children}
    </ToolButton>
  </DropdownMenu.Trigger>
));
MenuTriggerButton.displayName = "MenuTriggerButton";

function LayoutIcon({ id }: { id: string }) {
  const cell = "bg-current";
  return (
    <span className="grid size-7 shrink-0 grid-cols-2 grid-rows-3 gap-px overflow-hidden rounded border border-current/30 p-0.5 text-primary">
      {id === "single" ? <span className={cn(cell, "col-span-2 row-span-3 rounded-sm")} /> : null}
      {id === "center" ? (
        <>
          <span className="col-span-2 opacity-30" />
          <span className={cn(cell, "col-span-2 rounded-sm")} />
          <span className="col-span-2 opacity-30" />
        </>
      ) : null}
      {id === "split" ? (
        <>
          <span className={cn(cell, "col-span-2 row-span-1 rounded-sm")} />
          <span className="col-span-2 opacity-30" />
          <span className={cn(cell, "col-span-2 rounded-sm")} />
        </>
      ) : null}
      {id === "react" ? (
        <>
          <span className={cn(cell, "col-span-2 rounded-sm")} />
          <span className={cn(cell, "col-span-2 row-span-2 rounded-sm opacity-50")} />
        </>
      ) : null}
      {id === "split-vertical" ? (
        <>
          <span className={cn(cell, "row-span-3 rounded-sm")} />
          <span className={cn(cell, "row-span-3 rounded-sm opacity-50")} />
        </>
      ) : null}
      {id === "tri-split" ? (
        <>
          <span className={cn(cell, "col-span-2 rounded-sm")} />
          <span className={cn(cell, "col-span-2 rounded-sm opacity-60")} />
          <span className={cn(cell, "col-span-2 rounded-sm opacity-30")} />
        </>
      ) : null}
    </span>
  );
}

function AddTranscriptDialog({ open, onOpenChange, words, startTime, endTime, durationSec, onPick }: { open: boolean; onOpenChange: (v: boolean) => void; words: Word[]; startTime: number; endTime: number; durationSec: number; onPick: (s: number, e: number) => void }) {
  const sentences = useMemo(() => toSentences(words).filter((s) => s.end <= startTime + 0.05 || s.start >= endTime - 0.05), [words, startTime, endTime]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Adicionar trecho da transcrição</DialogTitle>
          <DialogDescription>Escolha uma frase fora do corte atual. O intervalo é estendido para incluí-la.</DialogDescription>
        </DialogHeader>
        <div className="scrollbar-thin max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
          {sentences.length ? (
            sentences.map((s, i) => {
              const before = s.end <= startTime + 0.05;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    const ns = Math.max(0, Math.min(startTime, s.start));
                    const ne = Math.min(durationSec || Infinity, Math.max(endTime, s.end));
                    onPick(ns, ne);
                    onOpenChange(false);
                  }}
                  className="flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm hover:border-primary/60 hover:bg-secondary/60"
                >
                  <span className="mt-0.5 w-16 shrink-0 font-mono text-[11px] text-muted-foreground">
                    {fmtRuler(Math.round(s.start))}
                    <span className={cn("block text-[9px] uppercase tracking-wider", before ? "text-warning" : "text-success")}>{before ? "antes" : "depois"}</span>
                  </span>
                  <span className="flex-1 leading-snug">{s.text}</span>
                </button>
              );
            })
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Não há frases fora do corte nas proximidades.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
