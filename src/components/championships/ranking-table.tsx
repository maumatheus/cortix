"use client";

import { Medal } from "lucide-react";
import { cn, formatBRL, formatCompact } from "@/lib/utils";
import { PRIZE_TABLE, prizeForPosition } from "@/lib/championships";
import { EmptyState } from "@/components/ui/card";
import type { Championship, RankingRow } from "./types";

export function RankingTable({ rows, championship }: { rows: RankingRow[]; championship: Championship }) {
  const isRanking = championship.kind === "ranking";
  return (
    <div className="space-y-6">
      {rows.length === 0 ? (
        <EmptyState icon={<Medal />} title="Ranking ainda vazio" description="Assim que os primeiros vídeos forem registrados, o ranking aparece aqui. Seja o primeiro a entrar!" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Creator</th>
                <th className="px-4 py-3 text-right">Vídeos</th>
                <th className="px-4 py-3 text-right">Views</th>
                <th className="px-4 py-3 text-right">{isRanking ? "Prêmio estimado" : "Ganho estimado"}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.position} className={cn(r.isMe && "bg-primary/10")}>
                  <td className="px-4 py-3 font-mono font-bold">
                    <span className={cn("inline-flex size-7 items-center justify-center rounded-full", r.position === 1 ? "bg-warning/20 text-warning" : r.position === 2 ? "bg-foreground/10" : r.position === 3 ? "bg-orange-500/20 text-orange-400" : "text-muted-foreground")}>
                      {r.position}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {r.name}
                    {r.isMe ? <span className="ml-2 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">você</span> : null}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{r.videos}</td>
                  <td className="px-4 py-3 text-right font-mono">{formatCompact(r.views)}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {r.prize > 0 ? (
                      <span className="font-semibold text-success">{formatBRL(r.prize)}</span>
                    ) : isRanking && !r.qualified ? (
                      <span className="text-[11px] text-muted-foreground">abaixo de {formatCompact(championship.minViews)} views</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isRanking ? (
        <div className="rounded-2xl border bg-card p-5">
          <p className="eyebrow">Tabela de premiação</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Estimativa com base no prêmio total de <span className="font-semibold text-foreground">{formatBRL(championship.prizeTotal)}</span>. Mínimo de {formatCompact(championship.minViews)} views ganhas para entrar no ranking. A tabela oficial da edição prevalece sobre esta estimativa.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {PRIZE_TABLE.map((p) => (
              <div key={p.position} className="flex items-center justify-between rounded-lg border bg-secondary/30 px-3 py-2 text-xs">
                <span className="font-mono text-muted-foreground">{p.position}º</span>
                <span className="font-mono font-semibold text-success">{formatBRL(prizeForPosition(p.position, championship.prizeTotal))}</span>
              </div>
            ))}
          </div>
        </div>
      ) : championship.ratePer1000 ? (
        <p className="text-xs text-muted-foreground">
          Ganho estimado = views válidas ÷ 1.000 × {formatBRL(championship.ratePer1000)}. O valor final depende da validação do organizador e do orçamento disponível.
        </p>
      ) : null}
    </div>
  );
}
