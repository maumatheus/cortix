"use client";

import { memo } from "react";
import { Maximize2, Pause, Play, Repeat, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { fmtClip } from "./captions";
import { useTime } from "./stores";
import { Tip, ToolButton } from "./menu";
import type { Player } from "./use-player";

export const Transport = memo(function Transport({ player, startTime, endTime, onFullscreen }: { player: Player; startTime: number; endTime: number; onFullscreen: () => void }) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-t bg-[#0f0f11] px-3">
      <TimeDisplay player={player} startTime={startTime} endTime={endTime} />
      <div className="flex-1" />
      <Tip label="Ir ao início">
        <ToolButton onClick={() => player.seekRel(0)}>
          <SkipBack />
        </ToolButton>
      </Tip>
      <Tip label={player.playing ? "Pausar (Espaço)" : "Reproduzir (Espaço)"}>
        <button type="button" onClick={player.toggle} className="mx-1 flex size-9 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/90 cursor-pointer">
          {player.playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
        </button>
      </Tip>
      <Tip label="Ir ao fim">
        <ToolButton onClick={() => player.seek(endTime)}>
          <SkipForward />
        </ToolButton>
      </Tip>
      <div className="flex-1" />
      <Tip label={player.loop ? "Repetição ligada" : "Repetir"}>
        <ToolButton active={player.loop} onClick={() => player.setLoop(!player.loop)}>
          <Repeat />
        </ToolButton>
      </Tip>
      <Tip label={player.muted ? "Ativar som" : "Silenciar"}>
        <ToolButton onClick={() => player.setMuted(!player.muted)}>{player.muted ? <VolumeX /> : <Volume2 />}</ToolButton>
      </Tip>
      <Tip label="Tela cheia">
        <ToolButton onClick={onFullscreen}>
          <Maximize2 />
        </ToolButton>
      </Tip>
    </div>
  );
});

function TimeDisplay({ player, startTime, endTime }: { player: Player; startTime: number; endTime: number }) {
  const t = useTime(player.time);
  return (
    <span className="font-mono text-xs tabular-nums text-muted-foreground">
      <span className="text-foreground">{fmtClip(t - startTime)}</span> / {fmtClip(endTime - startTime)}
    </span>
  );
}
