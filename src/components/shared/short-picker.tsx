"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clapperboard } from "lucide-react";
import { useFetch } from "@/lib/hooks";
import { cn, formatClock } from "@/lib/utils";
import { Label, NativeSelect } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/progress";

export interface PickerShort {
  id: string;
  title: string;
  status: string;
  score: number;
  startTime: number;
  endTime: number;
  thumbnailUrl: string | null;
  renderUrl: string | null;
  projectId: string;
  isScheduled?: boolean;
  isInLauncher?: boolean;
}

interface ProjectLite {
  id: string;
  title: string;
  status: string;
  shortsCount: number;
}

const STATUS_LABEL: Record<string, string> = { pending: "Processando", ready: "Pronto", rendering: "Renderizando", rendered: "Renderizado", failed: "Falhou" };

/**
 * Seletor de cortes: escolhe um projeto e marca um (ou vários) cortes.
 * Busca em GET /api/v1/projects e GET /api/v1/projects/[id].
 */
export function ShortPicker({
  selected,
  onChange,
  multiple = false,
  readyOnly = true,
  preselectedId,
  className,
}: {
  selected: string[];
  onChange: (ids: string[], shorts: PickerShort[]) => void;
  multiple?: boolean;
  readyOnly?: boolean;
  preselectedId?: string | null;
  className?: string;
}) {
  const { data: projects, loading: loadingProjects } = useFetch<{ data: ProjectLite[] }>("/api/v1/projects?limit=60&status=ready");
  const [projectId, setProjectId] = useState("");
  const list = useMemo(() => projects?.data ?? [], [projects]);

  useEffect(() => {
    if (!projectId && list.length) setProjectId(list[0].id);
  }, [list, projectId]);

  const { data: detail, loading: loadingShorts } = useFetch<{ data: PickerShort[] }>(projectId ? `/api/v1/projects/${projectId}?limit=96&sort=score` : null);
  const shorts = useMemo(() => {
    const all = detail?.data ?? [];
    return readyOnly ? all.filter((s) => ["ready", "rendered", "rendering"].includes(s.status)) : all;
  }, [detail, readyOnly]);

  // se veio ?short=ID de outro projeto, tenta localizar o projeto dono
  useEffect(() => {
    if (!preselectedId || !list.length || projectId) return;
    (async () => {
      for (const p of list.slice(0, 12)) {
        try {
          const r = await fetch(`/api/v1/projects/${p.id}?limit=96`, { credentials: "same-origin" });
          const j = (await r.json()) as { data: PickerShort[] };
          if (j.data?.some((s) => s.id === preselectedId)) {
            setProjectId(p.id);
            return;
          }
        } catch {}
      }
    })();
  }, [preselectedId, list, projectId]);

  function toggle(s: PickerShort) {
    if (multiple) {
      const next = selected.includes(s.id) ? selected.filter((x) => x !== s.id) : [...selected, s.id];
      onChange(next, shorts.filter((x) => next.includes(x.id)));
    } else {
      onChange([s.id], [s]);
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <Label>Projeto</Label>
        {loadingProjects ? (
          <Skeleton className="mt-1 h-10 w-full" />
        ) : list.length === 0 ? (
          <p className="mt-1 rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">Você ainda não tem projetos prontos. Crie um projeto e gere cortes primeiro.</p>
        ) : (
          <NativeSelect value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1 w-full">
            {list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} · {p.shortsCount} cortes
              </option>
            ))}
          </NativeSelect>
        )}
      </div>
      {projectId ? (
        <div>
          <Label>
            Cortes {multiple ? <span className="ml-1 text-foreground">{selected.length} selecionados</span> : null}
          </Label>
          <div className="scrollbar-thin mt-1 grid max-h-64 grid-cols-3 gap-2 overflow-y-auto rounded-lg border p-2 sm:grid-cols-4">
            {loadingShorts && !detail ? (
              [0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[9/16] w-full" />)
            ) : shorts.length === 0 ? (
              <div className="col-span-full flex flex-col items-center gap-2 py-6 text-center text-xs text-muted-foreground">
                <Clapperboard className="size-5" />
                Nenhum corte pronto neste projeto.
              </div>
            ) : (
              shorts.map((s) => {
                const on = selected.includes(s.id);
                return (
                  <button key={s.id} type="button" onClick={() => toggle(s)} className={cn("group relative aspect-[9/16] overflow-hidden rounded-lg border bg-secondary text-left transition", on ? "border-primary ring-2 ring-primary/40" : "hover:border-foreground/30")} title={s.title}>
                    {s.thumbnailUrl ? <img src={s.thumbnailUrl} alt="" className="size-full object-cover" /> : <div className="size-full bg-[linear-gradient(135deg,#1c1c24,#2a2438)]" />}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1.5">
                      <p className="line-clamp-2 text-[10px] font-semibold leading-tight text-white">{s.title}</p>
                      <p className="mt-0.5 font-mono text-[9px] text-white/70">
                        {formatClock(s.endTime - s.startTime)} · {s.score ? s.score.toFixed(1) : "–"}
                      </p>
                    </div>
                    <span className={cn("absolute left-1 top-1 rounded bg-black/70 px-1 py-0.5 font-mono text-[8px] uppercase text-white", s.status === "rendered" && "bg-success/80 text-black")}>{STATUS_LABEL[s.status] ?? s.status}</span>
                    {on ? (
                      <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-white">
                        <Check className="size-3" />
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
