"use client";

import { Heart, MessageCircle, Share } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CaptionStyle } from "@/lib/caption-styles";

/** Prévia 9:16 estilo TikTok com o texto "SEU VÍDEO VIRAL" no estilo escolhido. */
export function CaptionPreview({ style, handle = "@seucanal", className, fontFamily }: { style: CaptionStyle; handle?: string; className?: string; fontFamily?: string }) {
  const words = ["Seu", "vídeo", "viral"];
  const ff = fontFamily || style.fontFamily;
  return (
    <div className={cn("relative aspect-[9/16] w-full overflow-hidden rounded-2xl border bg-[radial-gradient(circle_at_30%_20%,#0d2733,#07090c_60%)]", className)}>
      <div className="absolute right-3 top-3 rounded-full border bg-black/50 px-2 py-1 text-[10px] font-semibold text-white/90">{ff}</div>
      <div className={cn("absolute inset-x-3 flex flex-col items-center justify-center text-center", style.position === "bottom" ? "bottom-[22%]" : style.position === "top" ? "top-[16%]" : "top-1/2 -translate-y-1/2")}>
        {style.id === "none" ? (
          <span className="text-xs text-white/40">Sem legenda</span>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-x-[0.3em] leading-[0.95]" style={{ fontFamily: `"${ff}", Montserrat, sans-serif`, fontWeight: style.fontWeight, fontSize: `${style.fontSize / 3.2}px`, fontStyle: style.italic ? "italic" : "normal" }}>
            {words.map((w, i) => {
              const hl = style.highlightMode !== "none" && i === 1;
              const color = hl ? style.highlightColor : i === 2 && style.accent2 ? style.accent2 : style.fillColor;
              return (
                <span
                  key={w}
                  style={{
                    color,
                    WebkitTextStroke: `${Math.max(0.5, style.strokeWidth / 6)}px ${style.strokeColor}`,
                    textShadow: style.shadow ? "2px 2px 0 rgba(0,0,0,.6)" : undefined,
                    textTransform: style.textCase === "uppercase" ? "uppercase" : "none",
                    background: hl && style.highlightMode === "box" ? `${style.highlightColor}33` : undefined,
                    borderRadius: 6,
                    padding: hl && style.highlightMode === "box" ? "0 .15em" : undefined,
                    transform: hl ? "scale(1.06)" : undefined,
                    display: "inline-block",
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
        )}
      </div>
      <div className="absolute bottom-4 left-3 right-14 text-white">
        <p className="text-xs font-bold">{handle}</p>
        <p className="text-[10px] text-white/80">Corte gerado por IA ✨</p>
      </div>
      <div className="absolute bottom-6 right-3 flex flex-col items-center gap-3 text-white">
        <div className="flex flex-col items-center">
          <Heart className="size-5 fill-red-500 text-red-500" />
          <span className="text-[9px] font-semibold">124k</span>
        </div>
        <div className="flex flex-col items-center">
          <MessageCircle className="size-5" />
          <span className="text-[9px] font-semibold">2.301</span>
        </div>
        <div className="flex flex-col items-center">
          <Share className="size-5" />
          <span className="text-[9px] font-semibold">18k</span>
        </div>
      </div>
    </div>
  );
}

/** Miniatura do estilo para o grid de seleção. */
export function StyleTile({ style, selected, onClick }: { style: CaptionStyle; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("group flex flex-col gap-2 text-left", selected && "")}>
      <div className={cn("relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-xl border bg-[linear-gradient(135deg,#1c1c24,#2a2438)] transition", selected ? "border-primary ring-2 ring-primary/40" : "hover:border-foreground/30")}>
        {style.id === "none" ? (
          <span className="flex size-9 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/60 text-muted-foreground">⌀</span>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-x-1 px-2 text-center leading-none" style={{ fontFamily: `"${style.fontFamily}", Montserrat, sans-serif`, fontWeight: style.fontWeight, fontSize: `${Math.min(22, style.fontSize / 4)}px`, fontStyle: style.italic ? "italic" : "normal" }}>
            {["Seu", "vídeo", "viral"].map((w, i) => (
              <span
                key={w}
                style={{
                  color: style.highlightMode !== "none" && i === 1 ? style.highlightColor : i === 2 && style.accent2 ? style.accent2 : style.fillColor,
                  WebkitTextStroke: `${Math.max(0.4, style.strokeWidth / 10)}px ${style.strokeColor}`,
                  textTransform: style.textCase === "uppercase" ? "uppercase" : "none",
                  textShadow: style.shadow ? "1px 1px 0 rgba(0,0,0,.6)" : undefined,
                }}
              >
                {w}
              </span>
            ))}
          </div>
        )}
        {selected ? <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">✓</span> : null}
      </div>
      <span className={cn("text-xs font-medium", selected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>{style.name}</span>
    </button>
  );
}
