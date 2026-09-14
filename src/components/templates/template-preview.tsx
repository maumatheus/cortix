"use client";

import { cn } from "@/lib/utils";
import { getCaptionStyle, LAYOUTS } from "@/lib/caption-styles";

/** Prévia 9:16 compacta de um template: layout + legenda no estilo escolhido. */
export function TemplatePreview({ styleId, layout, font, className }: { styleId: string; layout: string; font: string; className?: string }) {
  const style = getCaptionStyle(styleId);
  const lay = LAYOUTS.find((l) => l.id === layout) ?? LAYOUTS[0];
  const words = ["Seu", "vídeo", "viral"];
  return (
    <div className={cn("relative aspect-[9/16] w-full overflow-hidden rounded-xl border bg-[radial-gradient(circle_at_30%_20%,#2b1b4a,#0a0a0a_60%)]", className)}>
      <LayoutSkeleton layout={lay.id} />
      <div className={cn("absolute inset-x-2 flex justify-center text-center", style.position === "bottom" ? "bottom-[18%]" : style.position === "top" ? "top-[14%]" : "top-1/2 -translate-y-1/2")}>
        {style.id === "none" ? (
          <span className="text-[9px] text-white/40">Sem legenda</span>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-x-1 leading-none" style={{ fontFamily: `"${font || style.fontFamily}", Montserrat, sans-serif`, fontWeight: style.fontWeight, fontSize: `${Math.min(18, style.fontSize / 5)}px`, fontStyle: style.italic ? "italic" : "normal" }}>
            {words.map((w, i) => {
              const hl = style.highlightMode !== "none" && i === 1;
              return (
                <span
                  key={w}
                  style={{
                    color: hl ? style.highlightColor : i === 2 && style.accent2 ? style.accent2 : style.fillColor,
                    WebkitTextStroke: `${Math.max(0.4, style.strokeWidth / 12)}px ${style.strokeColor}`,
                    textTransform: style.textCase === "uppercase" ? "uppercase" : "none",
                    textShadow: style.shadow ? "1px 1px 0 rgba(0,0,0,.6)" : undefined,
                    background: hl && style.highlightMode === "box" ? `${style.highlightColor}33` : undefined,
                    borderRadius: 3,
                    padding: hl && style.highlightMode === "box" ? "0 .1em" : undefined,
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
        )}
      </div>
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <span className="rounded bg-black/60 px-1 py-0.5 font-mono text-[8px] uppercase text-white/80">{lay.name}</span>
        <span className="size-2 rounded-full" style={{ background: style.highlightColor }} />
      </div>
    </div>
  );
}

function LayoutSkeleton({ layout }: { layout: string }) {
  const box = "absolute rounded-sm bg-white/10 border border-white/10";
  switch (layout) {
    case "split":
      return (
        <>
          <div className={cn(box, "inset-x-2 top-2 h-[46%]")} />
          <div className={cn(box, "inset-x-2 bottom-2 h-[46%]")} />
        </>
      );
    case "react":
      return (
        <>
          <div className={cn(box, "inset-x-2 top-2 h-[55%]")} />
          <div className={cn(box, "inset-x-2 bottom-2 h-[38%] bg-white/5")} />
        </>
      );
    case "split-vertical":
      return (
        <>
          <div className={cn(box, "inset-y-2 left-2 w-[46%]")} />
          <div className={cn(box, "inset-y-2 right-2 w-[46%]")} />
        </>
      );
    case "tri-split":
      return (
        <>
          <div className={cn(box, "inset-x-2 top-2 h-[30%]")} />
          <div className={cn(box, "inset-x-2 top-[35%] h-[30%]")} />
          <div className={cn(box, "inset-x-2 bottom-2 h-[30%]")} />
        </>
      );
    case "center":
      return (
        <>
          <div className="absolute inset-0 bg-white/5 blur-sm" />
          <div className={cn(box, "inset-x-2 top-1/2 h-[30%] -translate-y-1/2")} />
        </>
      );
    default:
      return <div className={cn(box, "inset-2")} />;
  }
}
