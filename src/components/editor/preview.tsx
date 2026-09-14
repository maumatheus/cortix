"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CaptionGroup } from "@/lib/video/transcript";
import type { EditorStyle, GuideId, ShapeOverlay } from "./types";
import { GUIDE_ZONES, OVERLAYS, VIDEO_FILTERS } from "./constants";
import { emojiFor, findGroupIndex } from "./captions";
import { useTime } from "./stores";
import type { Player } from "./use-player";

export interface PreviewProps {
  src: string | null;
  poster: string | null;
  player: Player;
  layout: string;
  style: EditorStyle;
  captions: CaptionGroup[];
  hook: string | null;
  startTime: number;
  shapes: ShapeOverlay[];
  selectedShape: string | null;
  onSelectShape: (id: string | null) => void;
  onMoveShape: (id: string, x: number, y: number, phase: "start" | "move" | "end") => void;
  onRemoveShape: (id: string) => void;
  activeOverlays: string[];
  guide: GuideId;
  rulers: boolean;
  guides: boolean;
  zoom: number | "fit";
  imax: boolean;
}

/** Canvas 9:16 com o vídeo recortado via CSS conforme o layout. */
export function Preview(p: PreviewProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = 16;
  let cw = 0;
  let ch = 0;
  if (size.h > 0) {
    if (p.zoom === "fit") {
      ch = Math.max(0, size.h - pad * 2);
      cw = (ch * 9) / 16;
      if (cw > size.w - pad * 2) {
        cw = Math.max(0, size.w - pad * 2);
        ch = (cw * 16) / 9;
      }
    } else {
      ch = 1920 * p.zoom * 0.25;
      cw = (ch * 9) / 16;
    }
  }
  const scale = cw / 1080;
  const filter = p.style.filter ? VIDEO_FILTERS.find((f) => f.id === p.style.filter)?.css : undefined;

  return (
    <div ref={areaRef} className={cn("relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#0b0b0d]", p.zoom !== "fit" && "items-start justify-start")}>
      {p.rulers ? <Rulers cw={cw} ch={ch} /> : null}
      <div className="relative shrink-0" style={{ width: cw, height: ch, margin: pad }}>
        <div className="absolute inset-0 overflow-hidden rounded-md bg-black shadow-[0_0_0_1px_rgba(255,255,255,.08),0_30px_80px_-20px_rgba(0,0,0,.9)]" onPointerDown={() => p.onSelectShape(null)}>
          {p.src ? (
            <VideoLayout src={p.src} poster={p.poster} player={p.player} layout={p.layout} filter={filter} />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center text-xs text-muted-foreground">
              {p.poster ? <img src={p.poster} alt="" className="absolute inset-0 size-full object-cover opacity-40" /> : null}
              <span className="relative">Vídeo de origem indisponível. O projeto pode ter expirado.</span>
            </div>
          )}
          {p.activeOverlays.map((id) => {
            const o = OVERLAYS.find((x) => x.id === id);
            return o ? <div key={id} className="pointer-events-none absolute inset-0" style={{ background: o.css, mixBlendMode: id === "grao" ? "overlay" : "normal" }} /> : null;
          })}
          <CaptionOverlay captions={p.captions} style={p.style} scale={scale} time={p.player.time} hook={p.hook} startTime={p.startTime} />
          {p.shapes.map((s) => (
            <Shape key={s.id} shape={s} selected={p.selectedShape === s.id} onSelect={() => p.onSelectShape(s.id)} onMove={(x, y, ph) => p.onMoveShape(s.id, x, y, ph)} onRemove={() => p.onRemoveShape(s.id)} cw={cw} ch={ch} />
          ))}
          {p.guides ? (
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-y-0 left-1/3 w-px bg-cyan-400/40" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-cyan-400/40" />
              <div className="absolute inset-x-0 top-1/3 h-px bg-cyan-400/40" />
              <div className="absolute inset-x-0 top-2/3 h-px bg-cyan-400/40" />
              <div className="absolute inset-y-0 left-1/2 w-px bg-cyan-400/70" />
              <div className="absolute inset-x-0 top-1/2 h-px bg-cyan-400/70" />
            </div>
          ) : null}
          {p.guide !== "none" ? (
            <div className="pointer-events-none absolute inset-0">
              {GUIDE_ZONES[p.guide].map((z) => (
                <div key={z.label} className="absolute flex items-end justify-start border border-red-400/50 bg-red-500/20 p-1" style={{ left: `${z.x}%`, top: `${z.y}%`, width: `${z.w}%`, height: `${z.h}%` }}>
                  <span className="rounded bg-black/60 px-1 text-[9px] font-semibold uppercase tracking-wider text-red-200">{z.label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <span className="pointer-events-none absolute -bottom-5 left-0 text-[10px] text-muted-foreground">{p.imax ? "IMAX · " : ""}1080 × 1920</span>
      </div>
    </div>
  );
}

/* ---------- vídeo por layout ---------- */

function VideoLayout({ src, poster, player, layout, filter }: { src: string; poster: string | null; player: Player; layout: string; filter?: string }) {
  const base: React.CSSProperties = { filter };
  const main = (
    <video ref={player.setVideo} src={src} poster={poster || undefined} preload="auto" playsInline className="absolute inset-0 size-full object-cover" style={{ ...base, objectPosition: "50% 50%" }} />
  );
  switch (layout) {
    case "center":
      return (
        <>
          <SecondaryVideo src={src} player={player} className="absolute inset-0 size-full object-cover" style={{ filter: `blur(22px) brightness(.55) ${filter || ""}`, transform: "scale(1.15)" }} />
          <video ref={player.setVideo} src={src} poster={poster || undefined} preload="auto" playsInline className="absolute left-0 top-1/2 w-full -translate-y-1/2 object-contain" style={base} />
        </>
      );
    case "split":
      return (
        <>
          <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden">
            <video ref={player.setVideo} src={src} poster={poster || undefined} preload="auto" playsInline className="size-full object-cover" style={{ ...base, objectPosition: "0% 50%" }} />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1/2 overflow-hidden border-t border-white/10">
            <SecondaryVideo src={src} player={player} className="size-full object-cover" style={{ ...base, objectPosition: "100% 50%" }} />
          </div>
        </>
      );
    case "react":
      return (
        <>
          <div className="absolute inset-x-0 top-0 flex h-[42%] items-center overflow-hidden bg-black">
            <video ref={player.setVideo} src={src} poster={poster || undefined} preload="auto" playsInline className="w-full object-contain" style={base} />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[58%] overflow-hidden border-t border-white/10">
            <SecondaryVideo src={src} player={player} className="size-full object-cover" style={{ ...base, objectPosition: "50% 50%", transform: "scale(1.25)" }} />
          </div>
        </>
      );
    case "split-vertical":
      return (
        <>
          <div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
            <video ref={player.setVideo} src={src} poster={poster || undefined} preload="auto" playsInline className="size-full object-cover" style={{ ...base, objectPosition: "0% 50%" }} />
          </div>
          <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden border-l border-white/10">
            <SecondaryVideo src={src} player={player} className="size-full object-cover" style={{ ...base, objectPosition: "100% 50%" }} />
          </div>
        </>
      );
    case "tri-split":
      return (
        <>
          <div className="absolute inset-x-0 top-0 h-1/3 overflow-hidden">
            <video ref={player.setVideo} src={src} poster={poster || undefined} preload="auto" playsInline className="size-full object-cover" style={{ ...base, objectPosition: "0% 50%" }} />
          </div>
          <div className="absolute inset-x-0 top-1/3 h-1/3 overflow-hidden border-y border-white/10">
            <SecondaryVideo src={src} player={player} className="size-full object-cover" style={{ ...base, objectPosition: "50% 50%" }} />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1/3 overflow-hidden">
            <SecondaryVideo src={src} player={player} className="size-full object-cover" style={{ ...base, objectPosition: "100% 50%" }} />
          </div>
        </>
      );
    default:
      return main;
  }
}

function SecondaryVideo({ src, player, className, style }: { src: string; player: Player; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLVideoElement>(null);
  const attach = player.attachSecondary;
  useEffect(() => attach(ref.current), [attach, src]);
  return <video ref={ref} src={src} preload="auto" playsInline muted className={className} style={style} />;
}

/* ---------- legendas ao vivo ---------- */

const CaptionOverlay = memo(function CaptionOverlay({ captions, style, scale, time, hook, startTime }: { captions: CaptionGroup[]; style: EditorStyle; scale: number; time: Player["time"]; hook: string | null; startTime: number }) {
  const t = useTime(time);
  const idx = findGroupIndex(captions, t);
  const group = idx >= 0 ? captions[idx] : null;
  const emoji = useMemo(() => (group && style.emojis ? emojiFor(group.words.map((w) => w.text).join(" ")) : null), [group, style.emojis]);
  const showHook = !!hook && t - startTime < 3;

  const fontSize = Math.max(6, style.fontSize * scale);
  const stroke = Math.max(0, (style.strokeWidth / 4) * scale);
  const posCls = style.position === "bottom" ? "bottom-[19%]" : style.position === "top" ? "top-[13%]" : "top-1/2 -translate-y-1/2";

  return (
    <>
      {showHook ? (
        <div className="pointer-events-none absolute inset-x-[6%] top-[7%] text-center" style={{ fontSize: Math.max(8, 60 * scale), fontFamily: `"${style.fontFamily}", Montserrat, sans-serif`, fontWeight: 900 }}>
          <span className="inline-block rounded-md bg-white px-[.35em] py-[.12em] leading-tight text-black" style={{ boxShadow: "0 4px 20px rgba(0,0,0,.5)" }}>
            {hook}
          </span>
        </div>
      ) : null}
      {group && style.id !== "none" ? (
        <div className={cn("pointer-events-none absolute inset-x-[5%] flex justify-center text-center", posCls)}>
          <div
            className="flex flex-wrap items-center justify-center gap-x-[.28em] leading-[1.05]"
            style={{
              fontFamily: `"${style.fontFamily}", Montserrat, sans-serif`,
              fontWeight: style.fontWeight,
              fontSize,
              fontStyle: style.italic ? "italic" : "normal",
              textTransform: style.textCase === "uppercase" ? "uppercase" : "none",
              background: style.background || undefined,
              borderRadius: style.background ? 8 * scale : undefined,
              padding: style.background ? `${4 * scale}px ${10 * scale}px` : undefined,
            }}
          >
            {group.words.map((w, i) => {
              const active = style.highlightMode !== "none" && t >= w.start && t < w.end;
              const box = active && style.highlightMode === "box";
              return (
                <span
                  key={i}
                  style={{
                    color: active ? style.highlightColor : style.fillColor,
                    WebkitTextStroke: stroke ? `${stroke}px ${style.strokeColor}` : undefined,
                    paintOrder: "stroke fill",
                    textShadow: style.shadow ? `${2 * scale}px ${2 * scale}px ${2 * scale}px rgba(0,0,0,.7)` : undefined,
                    background: box ? `${style.highlightColor}44` : undefined,
                    borderRadius: box ? 6 * scale : undefined,
                    padding: box ? `0 ${5 * scale}px` : undefined,
                    transform: active && !box ? "scale(1.08)" : undefined,
                    display: "inline-block",
                    transition: "transform 80ms",
                  }}
                >
                  {w.text}
                </span>
              );
            })}
            {emoji ? <span style={{ WebkitTextStroke: 0 }}>{emoji}</span> : null}
          </div>
        </div>
      ) : null}
    </>
  );
});

/* ---------- formas ---------- */

function Shape({ shape, selected, onSelect, onMove, onRemove, cw, ch }: { shape: ShapeOverlay; selected: boolean; onSelect: () => void; onMove: (x: number, y: number, phase: "start" | "move" | "end") => void; onRemove: () => void; cw: number; ch: number }) {
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const body = (() => {
    const c = shape.color;
    switch (shape.kind) {
      case "square":
        return <div className="size-full" style={{ background: c }} />;
      case "rounded":
        return <div className="size-full rounded-[18%]" style={{ background: c }} />;
      case "circle":
        return <div className="size-full rounded-full" style={{ background: c }} />;
      case "triangle":
        return <div className="size-full" style={{ background: c, clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }} />;
      case "star":
        return <div className="size-full" style={{ background: c, clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)" }} />;
      case "line":
        return <div className="absolute inset-x-0 top-1/2 h-[12%] -translate-y-1/2" style={{ background: c }} />;
      case "arrow":
        return <div className="size-full" style={{ background: c, clipPath: "polygon(0 35%, 60% 35%, 60% 10%, 100% 50%, 60% 90%, 60% 65%, 0 65%)" }} />;
      case "heart":
        return (
          <svg viewBox="0 0 24 24" className="size-full" fill={c}>
            <path d="M12 21s-7-4.5-9.5-9C.7 8.5 2.5 4 6.5 4c2 0 3.5 1 4.5 2.5C12 5 13.5 4 15.5 4c4 0 5.8 4.5 4 8-2.5 4.5-7.5 9-7.5 9z" />
          </svg>
        );
      case "emoji":
        return <div className="flex size-full items-center justify-center leading-none" style={{ fontSize: (shape.w / 100) * cw * 0.8 }}>{shape.text}</div>;
      default:
        return null;
    }
  })();
  return (
    <div
      className={cn("absolute cursor-move touch-none select-none", selected && "outline outline-2 outline-primary outline-offset-2")}
      style={{ left: `${shape.x}%`, top: `${shape.y}%`, width: `${shape.w}%`, height: `${shape.h}%` }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect();
        drag.current = { sx: e.clientX, sy: e.clientY, ox: shape.x, oy: shape.y };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        onMove(shape.x, shape.y, "start");
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || !cw || !ch) return;
        const nx = Math.min(100 - shape.w, Math.max(0, d.ox + ((e.clientX - d.sx) / cw) * 100));
        const ny = Math.min(100 - shape.h, Math.max(0, d.oy + ((e.clientY - d.sy) / ch) * 100));
        onMove(nx, ny, "move");
      }}
      onPointerUp={(e) => {
        if (!drag.current) return;
        drag.current = null;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        onMove(shape.x, shape.y, "end");
      }}
    >
      {body}
      {selected ? (
        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onRemove} className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-destructive text-white shadow" title="Remover">
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
}

/* ---------- réguas ---------- */

function Rulers({ cw, ch }: { cw: number; ch: number }) {
  const ticks = (len: number, count: number) => Array.from({ length: count + 1 }, (_, i) => (len * i) / count);
  return (
    <div className="pointer-events-none absolute inset-0 z-10 font-mono text-[9px] text-muted-foreground/70">
      <div className="absolute left-1/2 top-0 h-4 -translate-x-1/2 border-b border-white/10" style={{ width: cw }}>
        {ticks(cw, 10).map((x, i) => (
          <span key={i} className="absolute top-0 h-full border-l border-white/20 pl-0.5" style={{ left: x }}>
            {i * 108}
          </span>
        ))}
      </div>
      <div className="absolute left-0 top-1/2 w-4 -translate-y-1/2 border-r border-white/10" style={{ height: ch }}>
        {ticks(ch, 10).map((y, i) => (
          <span key={i} className="absolute left-0 w-full border-t border-white/20 [writing-mode:vertical-rl]" style={{ top: y }}>
            {i * 192}
          </span>
        ))}
      </div>
    </div>
  );
}
