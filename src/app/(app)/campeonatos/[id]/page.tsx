"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, Calendar, ExternalLink, Eye, ShieldCheck, Trophy, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { api, useFetch } from "@/lib/hooks";
import { cn, formatBRL, formatCompact } from "@/lib/utils";
import { PLATFORMS, RANKING_CATEGORIES, STANDARD_RULES, formatDate, platformLabel, statusLabel, urlMatchesPlatform, type Platform } from "@/lib/championships";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Page } from "@/components/page-header";
import { RankingTable } from "@/components/championships/ranking-table";
import { AccountsDialog, PixDialog, RequirementsNotice } from "@/components/championships/setup";
import { requirementsMet, type ChampionshipDetail } from "@/components/championships/types";

const TABS = [
  { value: "overview", label: "Visão geral" },
  { value: "rules", label: "Regras" },
  { value: "submit", label: "Enviar vídeo" },
  { value: "entries", label: "Meus envios" },
  { value: "ranking", label: "Ranking" },
];

export default function CampeonatoPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { data, loading, error, reload } = useFetch<ChampionshipDetail>(id ? `/api/v1/championships/${id}` : null);
  const [tab, setTab] = useState("overview");
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [pixOpen, setPixOpen] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [videoUrl, setVideoUrl] = useState("");
  const [category, setCategory] = useState<string>("clip");
  const [sending, setSending] = useState(false);

  const c = data?.championship;
  const req = data?.requirements;
  const canSubmit = !!c && c.status === "active" && new Date(c.endDate).getTime() > Date.now();

  function participate() {
    setTab("submit");
    requestAnimationFrame(() => tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function configure() {
    if (req && !req.pixKey) setPixOpen(true);
    else setAccountsOpen(true);
  }

  async function submit() {
    if (!c) return;
    const url = videoUrl.trim();
    if (!url) return toast.error("Cole o link do vídeo publicado");
    if (!urlMatchesPlatform(url, platform)) return toast.error(`Esse link não parece ser do ${platformLabel(platform)}`);
    setSending(true);
    try {
      await api(`/api/v1/championships/${c.id}/entries`, { method: "POST", json: { videoUrl: url, platform, category: c.kind === "ranking" ? category : undefined } });
      toast.success("Vídeo registrado no campeonato!");
      setVideoUrl("");
      await reload();
      setTab("entries");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (error && !data) {
    return (
      <Page>
        <EmptyState
          icon={<Trophy />}
          title="Campeonato não encontrado"
          description={error}
          action={
            <Button asChild variant="outline">
              <Link href="/campeonatos">Voltar para campeonatos</Link>
            </Button>
          }
        />
      </Page>
    );
  }

  if (loading || !c) {
    return (
      <Page>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-4 h-72" />
        <Skeleton className="mt-6 h-11 w-full max-w-xl" />
        <Skeleton className="mt-4 h-48" />
      </Page>
    );
  }

  return (
    <Page>
      <Link href="/campeonatos" className="eyebrow inline-flex items-center gap-1.5 transition hover:text-foreground">
        <ArrowLeft className="size-3" /> Campeonatos
      </Link>

      <div className="mt-4 overflow-hidden rounded-3xl border bg-card">
        <div className="relative aspect-[16/5] min-h-36 bg-gradient-to-br from-primary/50 via-fuchsia-600/25 to-card">
          {c.bannerUrl ? <img src={c.bannerUrl} alt="" className="size-full object-cover" /> : <Trophy className="absolute right-8 top-1/2 size-20 -translate-y-1/2 text-white/20" />}
          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            <Badge variant={c.status === "active" ? "success" : c.status === "budget_exhausted" ? "warning" : "secondary"}>{statusLabel(c.status)}</Badge>
            <Badge variant="purple">{c.kind === "ranking" ? "Premiação por ranking" : "Pago por views"}</Badge>
            {c.joined ? <Badge variant="outline">Você participa</Badge> : null}
          </div>
        </div>
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_260px] md:items-end md:p-8">
          <div className="min-w-0">
            <p className="eyebrow">Organizado por {c.organizer}</p>
            <h1 className="display mt-2 text-3xl md:text-5xl">{c.title}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-3.5" /> {formatDate(c.startDate)} - {formatDate(c.endDate)}
              </span>
              <span className="inline-flex items-center gap-1.5" title="Participantes">
                <Users className="size-3.5" /> {formatCompact(c.participants)}
              </span>
              <span className="inline-flex items-center gap-1.5" title="Vídeos">
                <Video className="size-3.5" /> {formatCompact(c.videos)}
              </span>
              <span className="inline-flex items-center gap-1.5" title="Views">
                <Eye className="size-3.5" /> {formatCompact(c.views)}
              </span>
            </div>
          </div>
          <div className="rounded-2xl border bg-background/40 p-4">
            <p className="eyebrow">{c.kind === "cpm" ? "Garantidos pra creators" : "Em prêmios"}</p>
            <p className="mt-1 font-mono text-2xl font-bold text-success">{formatBRL(c.prizeTotal)}</p>
            {c.kind === "cpm" && c.ratePer1000 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-mono font-semibold text-foreground">{formatBRL(c.ratePer1000)}</span> / 1.000 views · {c.budgetUsedPct.toFixed(1)}% comprometido
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Mínimo de {formatCompact(c.minViews)} views ganhas</p>
            )}
            <Button onClick={participate} className="mt-3 w-full" disabled={!canSubmit}>
              {!canSubmit ? statusLabel(c.status === "active" ? "finished" : c.status) : c.joined ? "Enviar outro vídeo" : "Participar"}
            </Button>
          </div>
        </div>
      </div>

      {req ? <RequirementsNotice requirements={req} onConfigure={configure} className="mt-6" /> : null}

      <div ref={tabsRef} className="mt-8 scroll-mt-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="h-9 flex-none">
                {t.label}
                {t.value === "entries" && data && data.entries.length > 0 ? <span className="rounded-full bg-primary/20 px-1.5 font-mono text-[10px] text-primary">{data.entries.length}</span> : null}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview">
            <div className="rounded-2xl border bg-card p-6">
              <p className="eyebrow">Sobre o campeonato</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{c.description}</p>
            </div>
          </TabsContent>

          <TabsContent value="rules">
            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-6">
                <p className="eyebrow">Regras da edição</p>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{c.description}</p>
              </div>
              <div className="rounded-2xl border bg-card p-6">
                <p className="eyebrow flex items-center gap-2">
                  <ShieldCheck className="size-3.5 text-primary" /> Regras gerais Cortix
                </p>
                <ul className="mt-4 space-y-4">
                  {STANDARD_RULES.map((r) => (
                    <li key={r.title} className="flex gap-3">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      <div>
                        <p className="text-sm font-semibold">{r.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{r.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="submit">
            <div className="rounded-2xl border bg-card p-6">
              <p className="eyebrow">Enviar vídeo</p>
              <p className="mt-1 text-sm text-muted-foreground">Publique o corte em uma das suas contas conectadas e cole o link aqui. As views passam a contar a partir do registro.</p>
              {!canSubmit ? (
                <p className="mt-4 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 text-xs text-warning">Este campeonato não está aceitando novos envios.</p>
              ) : null}
              <div className={cn("mt-5 grid gap-4 md:grid-cols-[180px_1fr]", (!canSubmit || !requirementsMet(req)) && "pointer-events-none opacity-50")}>
                <div>
                  <Label htmlFor="entry-platform">Plataforma</Label>
                  <NativeSelect id="entry-platform" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className="mt-1 w-full">
                    {PLATFORMS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div>
                  <Label htmlFor="entry-url">Link do vídeo</Label>
                  <Input id="entry-url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder={platform === "youtube" ? "https://youtube.com/shorts/…" : platform === "instagram" ? "https://instagram.com/reel/…" : "https://tiktok.com/@perfil/video/…"} className="mt-1" />
                </div>
                {c.kind === "ranking" ? (
                  <div>
                    <Label htmlFor="entry-category">Categoria</Label>
                    <NativeSelect id="entry-category" value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full">
                      {RANKING_CATEGORIES.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                ) : null}
              </div>
              <div className="mt-5 flex items-center justify-end gap-3">
                <Button onClick={submit} loading={sending} disabled={!canSubmit || !requirementsMet(req)}>
                  Registrar vídeo
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="entries">
            {data && data.entries.length > 0 ? (
              <ul className="divide-y rounded-2xl border bg-card">
                {data.entries.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <Badge variant="mono">{platformLabel(e.platform)}</Badge>
                    {e.category ? <Badge variant="outline">{e.category.toUpperCase()}</Badge> : null}
                    <a href={e.videoUrl} target="_blank" rel="noreferrer" className="inline-flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm hover:text-primary">
                      <span className="truncate">{e.videoUrl}</span>
                      <ExternalLink className="size-3.5 shrink-0" />
                    </a>
                    <span className="font-mono text-xs text-muted-foreground">{formatDate(e.createdAt)}</span>
                    <span className="inline-flex items-center gap-1 font-mono text-sm font-semibold">
                      <Eye className="size-3.5 text-muted-foreground" /> {formatCompact(e.views)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Video />}
                title="Você ainda não enviou vídeos"
                description="Publique um corte e registre o link para começar a contar views neste campeonato."
                action={
                  canSubmit ? (
                    <Button onClick={participate}>Enviar vídeo</Button>
                  ) : null
                }
              />
            )}
          </TabsContent>

          <TabsContent value="ranking">
            <RankingTable rows={data?.ranking || []} championship={c} />
          </TabsContent>
        </Tabs>
      </div>

      <AccountsDialog open={accountsOpen} onOpenChange={setAccountsOpen} onChanged={reload} />
      <PixDialog open={pixOpen} onOpenChange={setPixOpen} onSaved={reload} />
    </Page>
  );
}
