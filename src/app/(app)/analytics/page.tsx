"use client";

import Link from "next/link";
import { BarChart3, Clapperboard, FolderOpen, Rocket, Send, Star, CalendarClock, Share2, Lock } from "lucide-react";
import { useFetch, useUser } from "@/lib/hooks";
import { cn, formatClock } from "@/lib/utils";
import { Page, PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlatformDot, platformInfo } from "@/components/shared/platform";
import { ChartStyles, GroupedColumns, HorizontalBars } from "@/components/analytics/charts";

interface Analytics {
  totals: { projects: number; projectsReady: number; shorts: number; rendered: number; renders: number; rendersDone: number; scheduled: number; published: number; inLauncher: number; accounts: number; avgScore: number; minutesAnalyzed: number; creditsSpent: number };
  weeks: Array<{ label: string; projects: number; shorts: number; posts: number }>;
  byPlatform: Array<{ platform: string; scheduled: number; published: number; accounts: number }>;
  scoreBuckets: Array<{ label: string; count: number }>;
  bestClips: Array<{ id: string; title: string; score: number; thumbnailUrl: string | null; projectId: string; projectTitle: string; duration: number; status: string; isPublished: boolean }>;
}

export default function AnalyticsPage() {
  const { user, loading: userLoading } = useUser();
  const isSub = !!user?.isSubscriber;
  const { data, loading } = useFetch<Analytics>(isSub ? "/api/v1/analytics" : null, { refreshMs: 30000 });

  return (
    <Page wide>
      <ChartStyles />
      <PageHeader eyebrow="Criar · Métricas" dot title="Analytics" description="Acompanhe o desempenho dos seus cortes nas redes sociais" />

      {userLoading ? (
        <Skeleton className="h-64" />
      ) : !isSub ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border bg-card px-6 py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Lock className="size-8" />
          </div>
          <p className="text-lg font-semibold">O Analytics requer um plano ativo</p>
          <p className="max-w-md text-sm text-muted-foreground">Assine um plano para conectar suas redes sociais e acompanhar métricas reais dos seus conteúdos.</p>
          <Button asChild className="mt-2">
            <Link href="/financeiro?tab=plans">Ver planos</Link>
          </Button>
        </div>
      ) : loading && !data ? (
        <div className="space-y-4">
          <Skeleton className="h-28" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      ) : data ? (
        <Dashboard a={data} />
      ) : null}
    </Page>
  );
}

function Dashboard({ a }: { a: Analytics }) {
  const t = a.totals;
  const publishRate = t.shorts ? Math.round((t.published / t.shorts) * 100) : 0;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <div className="rounded-2xl border bg-card p-6">
          <p className="eyebrow">Cortes gerados</p>
          <p className="mt-2 text-6xl font-semibold leading-none">{t.shorts.toLocaleString("pt-BR")}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            em {t.projects} projeto{t.projects === 1 ? "" : "s"} · {t.minutesAnalyzed} min analisados · {t.creditsSpent} créditos usados
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile icon={FolderOpen} label="Projetos prontos" value={t.projectsReady} sub={`${t.projects} no total`} />
          <Tile icon={Clapperboard} label="Renderizados" value={t.rendered} sub={`${t.rendersDone} renders concluídos`} />
          <Tile icon={Star} label="Nota média" value={t.avgScore ? t.avgScore.toFixed(1) : "–"} sub="de 10" />
          <Tile icon={CalendarClock} label="Agendados" value={t.scheduled} sub={`${t.inLauncher} em launchers`} />
          <Tile icon={Send} label="Publicados" value={t.published} sub={`${publishRate}% dos cortes`} />
          <Tile icon={Share2} label="Contas conectadas" value={t.accounts} sub="redes de publicação" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <p className="font-semibold">Produção por semana</p>
          <p className="mb-4 text-xs text-muted-foreground">Últimas 8 semanas · projetos criados, cortes gerados e posts publicados</p>
          <GroupedColumns data={a.weeks} categoryKey="label" series={[{ key: "projects", label: "Projetos" }, { key: "shorts", label: "Cortes" }, { key: "posts", label: "Publicados" }]} />
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="font-semibold">Publicações por rede</p>
          <p className="mb-4 text-xs text-muted-foreground">Posts agendados e publicados em cada plataforma</p>
          {a.byPlatform.every((p) => !p.scheduled && !p.published) ? (
            <EmptyState className="py-8" icon={<Rocket />} title="Nada publicado ainda" description="Agende ou coloque cortes num launcher pra ver a distribuição por rede." />
          ) : (
            <HorizontalBars
              data={a.byPlatform}
              categoryKey="platform"
              series={[{ key: "scheduled", label: "Agendados" }, { key: "published", label: "Publicados" }]}
              labelRender={(d) => (
                <span className="flex items-center gap-2">
                  <PlatformDot platform={String(d.platform)} size="sm" /> {platformInfo(String(d.platform)).name}
                </span>
              )}
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-2xl border bg-card p-5">
          <p className="font-semibold">Distribuição das notas</p>
          <p className="mb-4 text-xs text-muted-foreground">Quantos cortes a IA colocou em cada faixa de viralidade</p>
          {t.shorts === 0 ? (
            <EmptyState className="py-8" icon={<BarChart3 />} title="Sem cortes ainda" description="Crie um projeto pra ver as notas aqui." />
          ) : (
            <HorizontalBars data={a.scoreBuckets} categoryKey="label" series={[{ key: "count", label: "Cortes" }]} labelRender={(d) => <span className="font-mono">{String(d.label)}</span>} />
          )}
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <p className="font-semibold">Melhores cortes</p>
          <p className="mb-4 text-xs text-muted-foreground">Ranking pela nota de viralidade da IA</p>
          {a.bestClips.length === 0 ? (
            <EmptyState className="py-8" icon={<Star />} title="Nenhum corte avaliado" description="Assim que a IA gerar cortes, os melhores aparecem aqui." />
          ) : (
            <div className="divide-y">
              {a.bestClips.map((c, i) => (
                <Link key={c.id} href={`/projects/${c.projectId}`} className="flex items-center gap-3 py-2.5 hover:bg-secondary/40">
                  <span className="w-5 font-mono text-xs text-muted-foreground">{i + 1}</span>
                  <div className="h-12 w-7 shrink-0 overflow-hidden rounded-md bg-secondary">{c.thumbnailUrl ? <img src={c.thumbnailUrl} alt="" className="size-full object-cover" /> : null}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {c.projectTitle} · {formatClock(c.duration)}
                      {c.isPublished ? " · publicado" : c.status === "rendered" ? " · renderizado" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full bg-primary")} style={{ width: `${Math.min(100, (c.score / 10) * 100)}%` }} />
                    </div>
                    <span className="w-8 text-right font-mono text-sm font-semibold tabular-nums">{c.score.toFixed(1)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5" />
        <p className="text-[11px]">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold leading-none">{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</p>
      {sub ? <p className="mt-1.5 text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}
