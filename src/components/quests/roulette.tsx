"use client";

import { useEffect, useRef, useState } from "react";
import { Gift, Lock } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const COLORS = ["#8b5cf6", "#c026d3", "#6d28d9", "#a855f7", "#7c3aed", "#d946ef"];

export function Roulette({ rewards, canSpin, nextSpinAt, onWin }: { rewards: number[]; canSpin: boolean; nextSpinAt: string | null; onWin: (reward: number) => void }) {
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const [countdown, setCountdown] = useState("");
  const turns = useRef(0);
  const n = rewards.length;
  const seg = 360 / n;

  useEffect(() => {
    if (!nextSpinAt || canSpin) {
      setCountdown("");
      return;
    }
    const tick = () => {
      const diff = new Date(nextSpinAt).getTime() - Date.now();
      if (diff <= 0) return setCountdown("");
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [nextSpinAt, canSpin]);

  async function spin() {
    if (spinning || !canSpin) return;
    setSpinning(true);
    setResult(null);
    try {
      const res = await api<{ reward: number; index: number }>("/api/v1/quests/spin", { method: "POST" });
      // O ponteiro fica no topo (0°). Gira até o centro do segmento sorteado ficar sob o ponteiro.
      turns.current += 5;
      const target = turns.current * 360 - (res.index * seg + seg / 2);
      setAngle(target);
      setTimeout(() => {
        setResult(res.reward);
        setSpinning(false);
        onWin(res.reward);
        toast.success(`Você ganhou ${res.reward} créditos na roleta!`);
      }, 4200);
    } catch (e) {
      setSpinning(false);
      toast.error((e as Error).message);
    }
  }

  const gradient = rewards.map((_, i) => `${COLORS[i % COLORS.length]} ${i * seg}deg ${(i + 1) * seg}deg`).join(", ");

  return (
    <div className="flex flex-col items-center">
      <div className="relative size-56 md:size-64">
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-2">
          <div className="size-0 border-x-[10px] border-t-[18px] border-x-transparent border-t-foreground drop-shadow" />
        </div>
        <div
          className="relative size-full rounded-full border-4 border-background shadow-[0_0_0_2px_var(--primary),0_20px_60px_-20px_var(--primary)]"
          style={{
            background: `conic-gradient(${gradient})`,
            transform: `rotate(${angle}deg)`,
            transition: spinning ? "transform 4.2s cubic-bezier(0.15, 0.85, 0.2, 1)" : "none",
          }}
        >
          {rewards.map((r, i) => {
            const a = i * seg + seg / 2;
            return (
              <span key={i} className="absolute left-1/2 top-1/2 font-mono text-sm font-black text-white drop-shadow" style={{ transform: `translate(-50%, -50%) rotate(${a}deg) translateY(-80px) rotate(-${a}deg)` }}>
                {r}
              </span>
            );
          })}
          <span className="absolute left-1/2 top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-background bg-card text-primary">
            <Gift className="size-5" />
          </span>
        </div>
      </div>
      <div className={cn("mt-5 h-7 text-center text-sm font-semibold transition", result !== null ? "text-success" : "text-muted-foreground")}>
        {result !== null ? `+${result} créditos!` : spinning ? "Girando…" : canSpin ? "Um giro grátis por dia." : countdown ? `Próximo giro em ${countdown}` : "Volte amanhã para girar de novo."}
      </div>
      <Button size="lg" className="mt-2 w-full max-w-xs" onClick={spin} disabled={!canSpin || spinning} loading={spinning}>
        {!canSpin && !spinning ? <Lock /> : null} Girar
      </Button>
    </div>
  );
}
