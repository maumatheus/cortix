"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, Trophy, Users, Video } from "lucide-react";
import { cn, formatBRL, formatCompact } from "@/lib/utils";
import { formatDate, statusLabel } from "@/lib/championships";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { Championship } from "./types";

function StatusBadge({ status }: { status: Championship["status"] }) {
  const variant = status === "active" ? "success" : status === "budget_exhausted" ? "warning" : "secondary";
  return <Badge variant={variant}>{statusLabel(status)}</Badge>;
}

export function prizeCompact(cents: number): string {
  return `R$ ${formatCompact(Math.round(cents / 100))}`;
}

export function ChampionshipCard({ c }: { c: Championship }) {
  const [more, setMore] = useState(false);
  const href = `/campeonatos/${c.id}`;
  const open = c.status === "active";
  const footer = c.status === "active" ? "Ainda dá tempo de entrar!" : c.status === "budget_exhausted" ? "Orçamento esgotado — fique de olho na próxima edição." : "Edição encerrada.";

  return (
    <div className={cn("group flex flex-col overflow-hidden rounded-2xl border bg-card transition hover:border-primary/50", !open && "opacity-90")}>
      <Link href={href} className="relative block aspect-[16/7] overflow-hidden bg-gradient-to-br from-[color:var(--brand-from)]/45 via-[color:var(--brand-to)]/20 to-card">
        {c.bannerUrl ? <img src={c.bannerUrl} alt="" className="size-full object-cover transition group-hover:scale-105" /> : <Trophy className="absolute right-5 top-1/2 size-14 -translate-y-1/2 text-white/25" />}
        <div className="absolute left-3 top-3">
          <StatusBadge status={c.status} />
        </div>
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 font-mono text-[11px] text-white">
          <Users className="size-3" /> {formatCompact(c.participants)}
        </span>
        {c.joined ? <span className="absolute bottom-3 left-3 rounded-md bg-success/90 px-2 py-0.5 text-[10px] font-bold text-black">Você participa</span> : null}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <Link href={href} className="line-clamp-2 text-base font-bold leading-snug hover:text-primary">
            {c.title}
          </Link>
          <p className="eyebrow mt-1.5">Organizado por {c.organizer}</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {formatDate(c.startDate)} - {formatDate(c.endDate)}
          </p>
        </div>

        {c.kind === "cpm" ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-success">{prizeCompact(c.prizeTotal)} garantidos pra creators</p>
            <Progress value={c.budgetUsedPct} className="h-1.5" />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{c.budgetUsedPct.toFixed(1)}% comprometido</span>
              {c.ratePer1000 ? <span className="font-mono font-semibold text-foreground">{formatBRL(c.ratePer1000)} / 1.000 views</span> : null}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className={cn("text-xs leading-relaxed text-muted-foreground whitespace-pre-line", !more && "line-clamp-3")}>{c.description}</p>
            {c.description.length > 140 ? (
              <button onClick={() => setMore((v) => !v)} className="text-[11px] font-semibold text-primary hover:underline cursor-pointer">
                {more ? "ver menos" : "ver mais"}
              </button>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-success">{prizeCompact(c.prizeTotal)} em prêmios</p>
              <Badge variant="purple">Premiação por ranking</Badge>
            </div>
          </div>
        )}

        <div className="mt-auto flex items-center gap-3 border-t pt-3 font-mono text-[11px] text-muted-foreground" title="participantes • vídeos • views">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" /> {formatCompact(c.participants)}
          </span>
          <span aria-hidden>•</span>
          <span className="inline-flex items-center gap-1">
            <Video className="size-3.5" /> {formatCompact(c.videos)}
          </span>
          <span aria-hidden>•</span>
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3.5" /> {formatCompact(c.views)}
          </span>
        </div>
        <p className={cn("text-xs font-semibold", open ? "text-primary" : "text-muted-foreground")}>{footer}</p>
      </div>
    </div>
  );
}
