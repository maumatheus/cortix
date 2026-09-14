"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CaptionGroup } from "@/lib/video/transcript";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pop, PopAnchor, PopContent } from "./menu";
import { fmtRuler, groupText } from "./captions";
import { useTime, type TimeStore } from "./stores";
import type { Player } from "./use-player";

export interface TimelineView {
  from: number;
  to: number;
}

export interface TimelineProps {
  player: Player;
  startTime: number;
  endTime: number;
  durationSec: number;
  captions: CaptionGroup[];
  selected: number | null;
  onSelect: (i: number | null) => void;
  thumbnailUrl: string | null;
  magnet: boolean;
  view: TimelineView;
  zoom: number;
  captionsHidden: boolean;
  videoHidden: boolean;
  onToggleCaptionsHidden: () => void;
  onToggleVideoHidden: () => void;
  onDragStart: () => void;
  onGroupRetime: (i: number, start: number, end: number) => void;
  onGroupText: (i: number, text: string) => void;
  onTrim: (start: number, end: number, commit: boolean) => void;
}

const SNAP_PX = 8;
const MIN_CLIP = 3;

function startDrag(e: React.PointerEvent, onMove: (dx: number) => void, onEnd: () => void) {
  const el = e.currentTarget as HTMLElement;
  const sx = e.clientX;
  e.preventDefault();
  e.stopPropagation();
  el.setPointerCapture(e.pointerId);
  const move = (ev: PointerEvent) => onMove(ev.clientX - sx);
  const up = () => {
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
    onEnd();
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
}

export function Timeline(p: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const span = Math.max(0.5, p.view.to - p.view.from);
  const pps = width > 0 ? (width * p.zoom) / span : 1;
  const W = span * pps;
  const x = useCallback((t: number) => (t - p.view.from) * pps, [p.view.from, pps]);
  const tAt = useCallback((px: number) => p.view.from + px / pps, [p.view.from, pps]);

  const snapCandidates = useMemo(() => {
    const c = [p.startTime, p.endTime];
    for (const g of p.captions) c.push(g.start, g.end);
    return c;
  }, [p.captions, p.startTime, p.endTime]);

  const snap = useCallback(
    (t: number, exclude: number[] = []) => {
      if (!p.magnet) return t;
      const cands = [...snapCandidates, p.player.time.get()];
      let best = t;
      let bestD = SNAP_PX / pps;
      for (const c of cands) {
        if (exclude.some((e) => Math.abs(e - c) < 1e-6)) continue;
        const d = Math.abs(c - t);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      return best;
    },
    [p.magnet, snapCandidates, pps, p.player.time],
  );

  // mantém o cursor visível durante a reprodução
  useEffect(() => {
    return p.player.time.subscribe(() => {
      const el = scrollRef.current;
      if (!el) return;
      const px = x(p.player.time.get());
      if (px < el.scrollLeft || px > el.scrollLeft + el.clientWidth - 20) el.scrollLeft = Math.max(0, px - el.clientWidth * 0.2);
    });
  }, [p.player.time, x]);

  const seekAt = (e: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    p.player.seek(tAt(e.clientX - rect.left + el.scrollLeft));
  };

  // régua
  const ticks = useMemo(() => {
    const steps = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    const step = steps.find((s) => s * pps >= 64) || 300;
    const out: number[] = [];
    for (let t = Math.ceil(p.view.from / step) * step; t <= p.view.to; t += step) out.push(Math.round(t * 1000) / 1000);
    return { step, out };
  }, [pps, p.view.from, p.view.to]);

  return (
    <div className="flex h-full min-h-0 select-none border-t bg-[#0f0f11]">
      {/* coluna de rótulos */}
      <div className="flex w-36 shrink-0 flex-col border-r text-xs">
        <div className="h-6 border-b" />
        <TrackLabel name="Legendas" hidden={p.captionsHidden} onHide={p.onToggleCaptionsHidden} muted disabledMute className="h-12" />
        <TrackLabel name="Vídeo" hidden={p.videoHidden} onHide={p.onToggleVideoHidden} muted={p.player.muted} onMute={() => p.player.setMuted(!p.player.muted)} className="h-16" />
      </div>

      {/* área rolável */}
      <div ref={scrollRef} className="scrollbar-thin relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="relative" style={{ width: W, height: 24 + 48 + 64 }}>
          {/* régua */}
          <div
            className="absolute inset-x-0 top-0 h-6 cursor-pointer border-b bg-[#141417]"
            onPointerDown={(e) => {
              seekAt(e);
              startDrag(
                e,
                (dx) => {
                  const el = scrollRef.current;
                  if (!el) return;
                  const rect = el.getBoundingClientRect();
                  p.player.seek(tAt(e.clientX + dx - rect.left + el.scrollLeft));
                },
                () => {},
              );
            }}
          >
            {ticks.out.map((t) => (
              <div key={t} className="absolute top-0 h-full border-l border-white/15 pl-1 font-mono text-[9px] leading-6 text-muted-foreground" style={{ left: x(t) }}>
                {fmtRuler(t)}
              </div>
            ))}
            {/* faixa do corte */}
            <div className="absolute bottom-0 h-1 bg-primary/70" style={{ left: x(p.startTime), width: (p.endTime - p.startTime) * pps }} />
          </div>

          {/* trilha de legendas */}
          <div className={cn("absolute inset-x-0 top-6 h-12 border-b bg-[#121215]", p.captionsHidden && "opacity-40")} onPointerDown={(e) => e.target === e.currentTarget && p.onSelect(null)}>
            {p.captions.map((g, i) => (
              <CaptionBlock
                key={i}
                g={g}
                i={i}
                left={x(g.start)}
                width={Math.max(4, (g.end - g.start) * pps)}
                pps={pps}
                selected={p.selected === i}
                prevEnd={i > 0 ? p.captions[i - 1].end : p.startTime}
                nextStart={i < p.captions.length - 1 ? p.captions[i + 1].start : p.endTime}
                snap={snap}
                onSelect={() => p.onSelect(i)}
                onDragStart={p.onDragStart}
                onRetime={(s, e) => p.onGroupRetime(i, s, e)}
                onText={(t) => p.onGroupText(i, t)}
                onSeek={(t) => p.player.seek(t)}
              />
            ))}
            {!p.captions.length ? <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">Sem legendas neste corte.</span> : null}
          </div>

          {/* trilha de vídeo */}
          <div className={cn("absolute inset-x-0 top-[72px] h-16 bg-[#101013]", p.videoHidden && "opacity-40")}>
            <div className="absolute inset-y-0 bg-white/5" style={{ left: 0, width: x(p.startTime) }} />
            <div className="absolute inset-y-0 bg-white/5" style={{ left: x(p.endTime), right: 0 }} />
            <div
              className="absolute inset-y-1.5 overflow-hidden rounded-md border border-primary/60 bg-[#1b1530]"
              style={{
                left: x(p.startTime),
                width: (p.endTime - p.startTime) * pps,
                backgroundImage: p.thumbnailUrl ? `url(${p.thumbnailUrl})` : undefined,
                backgroundSize: "auto 100%",
                backgroundRepeat: "repeat-x",
              }}
            >
              <span className="absolute left-4 top-1 rounded bg-black/60 px-1.5 text-[10px] font-medium text-white">Vídeo · {fmtRuler(Math.round((p.endTime - p.startTime) * 10) / 10)}</span>
              <TrimHandle
                side="left"
                onDown={(e) => {
                  const orig = p.startTime;
                  p.onDragStart();
                  let last = orig;
                  startDrag(
                    e,
                    (dx) => {
                      last = Math.min(Math.max(0, snap(orig + dx / pps, [orig])), p.endTime - MIN_CLIP);
                      p.onTrim(last, p.endTime, false);
                    },
                    () => p.onTrim(last, p.endTime, true),
                  );
                }}
              />
              <TrimHandle
                side="right"
                onDown={(e) => {
                  const orig = p.endTime;
                  p.onDragStart();
                  let last = orig;
                  startDrag(
                    e,
                    (dx) => {
                      last = Math.max(Math.min(p.durationSec || Infinity, snap(orig + dx / pps, [orig])), p.startTime + MIN_CLIP);
                      p.onTrim(p.startTime, last, false);
                    },
                    () => p.onTrim(p.startTime, last, true),
                  );
                }}
              />
            </div>
          </div>

          <Playhead time={p.player.time} x={x} />
        </div>
      </div>
    </div>
  );
}

function TrackLabel({ name, hidden, onHide, muted, onMute, disabledMute, className }: { name: string; hidden: boolean; onHide: () => void; muted: boolean; onMute?: () => void; disabledMute?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1 border-b px-2", className)}>
      <span className="flex-1 truncate font-medium">{name}</span>
      <button type="button" onClick={onHide} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" title={hidden ? "Mostrar" : "Ocultar"}>
        {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
      <button type="button" onClick={onMute} disabled={disabledMute} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30" title={muted ? "Ativar som" : "Silenciar"}>
        {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
      </button>
    </div>
  );
}

function TrimHandle({ side, onDown }: { side: "left" | "right"; onDown: (e: React.PointerEvent) => void }) {
  return (
    <div onPointerDown={onDown} className={cn("absolute inset-y-0 z-10 flex w-3 cursor-ew-resize items-center justify-center bg-primary hover:bg-primary/80", side === "left" ? "left-0 rounded-l-md" : "right-0 rounded-r-md")}>
      <span className="h-5 w-0.5 rounded bg-white/80" />
    </div>
  );
}

const Playhead = memo(function Playhead({ time, x }: { time: TimeStore; x: (t: number) => number }) {
  const t = useTime(time);
  return (
    <div className="pointer-events-none absolute inset-y-0 z-20 w-px bg-red-500" style={{ left: x(t) }}>
      <span className="absolute -left-[5px] top-0 size-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-red-500" />
    </div>
  );
});

interface CaptionBlockProps {
  g: CaptionGroup;
  i: number;
  left: number;
  width: number;
  pps: number;
  selected: boolean;
  prevEnd: number;
  nextStart: number;
  snap: (t: number, exclude?: number[]) => number;
  onSelect: () => void;
  onDragStart: () => void;
  onRetime: (start: number, end: number) => void;
  onText: (text: string) => void;
  onSeek: (t: number) => void;
}

const CaptionBlock = memo(function CaptionBlock(b: CaptionBlockProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const g = b.g;
  const minLen = 0.2;

  const edge = (side: "left" | "right") => (e: React.PointerEvent) => {
    b.onSelect();
    b.onDragStart();
    const os = g.start;
    const oe = g.end;
    startDrag(
      e,
      (dx) => {
        const dt = dx / b.pps;
        if (side === "left") {
          const ns = Math.min(Math.max(b.prevEnd, b.snap(os + dt, [os])), oe - minLen);
          b.onRetime(ns, oe);
        } else {
          const ne = Math.max(Math.min(b.nextStart, b.snap(oe + dt, [oe])), os + minLen);
          b.onRetime(os, ne);
        }
      },
      () => {},
    );
  };

  const body = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    b.onSelect();
    const os = g.start;
    const oe = g.end;
    const len = oe - os;
    let started = false;
    startDrag(
      e,
      (dx) => {
        if (Math.abs(dx) < 3 && !started) return;
        if (!started) {
          started = true;
          b.onDragStart();
        }
        let ns = b.snap(os + dx / b.pps, [os, oe]);
        ns = Math.min(Math.max(b.prevEnd, ns), b.nextStart - len);
        b.onRetime(ns, ns + len);
      },
      () => {
        if (!started) b.onSeek(g.start);
      },
    );
  };

  return (
    <Pop open={editing} onOpenChange={setEditing}>
      <PopAnchor asChild>
        <div
          className={cn(
            "absolute top-1.5 flex h-9 items-center overflow-hidden rounded-md border bg-[#2a2140] text-[11px] leading-tight text-white/90 hover:border-primary/60",
            b.selected ? "border-primary ring-1 ring-primary/50" : "border-white/10",
          )}
          style={{ left: b.left, width: b.width }}
          onPointerDown={body}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setText(groupText(g));
            setEditing(true);
          }}
          title={groupText(g)}
        >
          <div onPointerDown={edge("left")} className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-primary/40 hover:bg-primary" />
          <span className="truncate px-2.5">{groupText(g) || "…"}</span>
          <div onPointerDown={edge("right")} className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-primary/40 hover:bg-primary" />
        </div>
      </PopAnchor>
      <PopContent side="top" align="start" className="w-80">
        <p className="mb-2 text-xs font-semibold">Editar legenda</p>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-20 text-sm" autoFocus onKeyDown={(e) => e.stopPropagation()} />
        <p className="mt-1 text-[11px] text-muted-foreground">As palavras são redistribuídas no tempo do bloco ({fmtRuler(Math.round(g.start * 10) / 10)} – {fmtRuler(Math.round(g.end * 10) / 10)}).</p>
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              b.onText(text);
              setEditing(false);
            }}
          >
            Aplicar
          </Button>
        </div>
      </PopContent>
    </Pop>
  );
});
