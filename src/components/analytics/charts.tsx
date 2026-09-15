"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Gráficos de barras em CSS puro (sem libs).
 * Paleta da marca Cortix: claro #0096c7/#00a878/#5b6572 · escuro #00d4ff/#00ffa3/#8a929e.
 * Marcas finas (<= 24px), ponta arredondada 4px, base reta, gap de 2px na cor da superfície, grid hairline.
 */
export function ChartStyles() {
  return (
    <style>{`
      .viz { --s1:#0096c7; --s2:#00a878; --s3:#5b6572; --grid:#e3e8ec; --base:#b9c2c9; }
      .dark .viz { --s1:#00d4ff; --s2:#00ffa3; --s3:#8a929e; --grid:#1a1f2c; --base:#2a313d; }
    `}</style>
  );
}

const SERIES_VAR = ["var(--s1)", "var(--s2)", "var(--s3)"];

export interface Series {
  key: string;
  label: string;
}

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {series.map((s, i) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: SERIES_VAR[i] }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 2 ? 0.5 : n <= 5 ? 1 : 2;
  return Math.ceil(n / step) * step * p;
}

/** Colunas agrupadas: uma categoria por coluna do grid, N séries lado a lado. */
export function GroupedColumns({ data, series, categoryKey, height = 160 }: { data: Array<Record<string, number | string>>; series: Series[]; categoryKey: string; height?: number }) {
  const [table, setTable] = useState(false);
  const max = niceMax(Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0))));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  return (
    <div className="viz">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Legend series={series} />
        <button onClick={() => setTable((v) => !v)} className="text-[11px] text-muted-foreground underline-offset-2 hover:underline">
          {table ? "Ver gráfico" : "Ver tabela"}
        </button>
      </div>
      {table ? (
        <DataTable data={data} series={series} categoryKey={categoryKey} />
      ) : (
        <div className="grid grid-cols-[32px_1fr] gap-2">
          <div className="relative font-mono text-[10px] text-muted-foreground" style={{ height }}>
            {ticks.map((t) => (
              <span key={t} className="absolute right-0 -translate-y-1/2 tabular-nums" style={{ bottom: `${(t / max) * 100}%` }}>
                {t}
              </span>
            ))}
          </div>
          <div>
            <div className="relative" style={{ height }}>
              {ticks.map((t) => (
                <div key={t} className="absolute inset-x-0 h-px" style={{ bottom: `${(t / max) * 100}%`, background: t === 0 ? "var(--base)" : "var(--grid)" }} />
              ))}
              <div className="absolute inset-0 flex items-end">
                {data.map((d, di) => (
                  <div key={di} className="group relative flex h-full flex-1 items-end justify-center gap-[2px] px-1">
                    {series.map((s, si) => {
                      const v = Number(d[s.key]) || 0;
                      return (
                        <div key={s.key} className="relative flex h-full w-full max-w-6 items-end">
                          <div className="w-full rounded-t-[4px] transition-all" style={{ height: `${(v / max) * 100}%`, background: SERIES_VAR[si], minHeight: v ? 2 : 0 }} />
                        </div>
                      );
                    })}
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1.5 text-[11px] shadow-lg group-hover:block">
                      <p className="font-semibold">{String(d[categoryKey])}</p>
                      {series.map((s, si) => (
                        <p key={s.key} className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="size-2 rounded-sm" style={{ background: SERIES_VAR[si] }} /> {s.label}: <span className="tabular-nums text-foreground">{Number(d[s.key]) || 0}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-1 flex">
              {data.map((d, i) => (
                <span key={i} className="flex-1 truncate text-center font-mono text-[10px] text-muted-foreground">
                  {String(d[categoryKey])}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Barras horizontais: uma linha por categoria, N séries empilhadas verticalmente dentro da linha. */
export function HorizontalBars({ data, series, categoryKey, labelRender }: { data: Array<Record<string, number | string>>; series: Series[]; categoryKey: string; labelRender?: (d: Record<string, number | string>) => React.ReactNode }) {
  const max = niceMax(Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0))));
  return (
    <div className="viz">
      <Legend series={series} />
      <div className={cn("space-y-3", series.length >= 2 && "mt-3")}>
        {data.map((d, di) => (
          <div key={di} className="grid grid-cols-[96px_1fr] items-center gap-3">
            <div className="truncate text-xs">{labelRender ? labelRender(d) : String(d[categoryKey])}</div>
            <div className="space-y-[2px]">
              {series.map((s, si) => {
                const v = Number(d[s.key]) || 0;
                return (
                  <div key={s.key} className="group relative flex h-[14px] items-center">
                    <div className="absolute inset-y-0 left-0 w-px" style={{ background: "var(--base)" }} />
                    <div className="h-full rounded-r-[4px] transition-all" style={{ width: `${(v / max) * 100}%`, background: SERIES_VAR[si], minWidth: v ? 2 : 0 }} />
                    <span className="ml-2 font-mono text-[10px] tabular-nums text-muted-foreground">{v}</span>
                    <span className="pointer-events-none absolute left-0 top-full z-10 mt-1 hidden whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-[11px] shadow-lg group-hover:block">
                      {s.label}: <span className="tabular-nums">{v}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataTable({ data, series, categoryKey }: { data: Array<Record<string, number | string>>; series: Series[]; categoryKey: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-xs">
        <thead className="bg-secondary/40 text-left text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Período</th>
            {series.map((s) => (
              <th key={s.key} className="px-3 py-2 text-right font-medium">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map((d, i) => (
            <tr key={i}>
              <td className="px-3 py-1.5 font-mono">{String(d[categoryKey])}</td>
              {series.map((s) => (
                <td key={s.key} className="px-3 py-1.5 text-right tabular-nums">
                  {Number(d[s.key]) || 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
