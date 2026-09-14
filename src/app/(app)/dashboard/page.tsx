"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Scissors, Sparkles, Upload, Video, Check, Wand2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { api, useFetch, useUser } from "@/lib/hooks";
import { formatDuration, timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/page-header";
import { BlankProjectDialog } from "@/components/app-shell";

interface Project {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  status: string;
  stage?: string | null;
  progress: number;
  durationSec: number;
  createdAt: string;
  expiresAt: string | null;
  shortsCount: number;
}
interface Champ {
  id: string;
  title: string;
  kind: string;
  prizeTotal: number;
  bannerUrl: string | null;
}

export default function DashboardPage() {
  const { user } = useUser();
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [blankOpen, setBlankOpen] = useState(false);
  const [champIdx, setChampIdx] = useState(0);
  const { data: projects } = useFetch<{ data: Project[] }>("/api/v1/projects?limit=6", { refreshMs: 8000 });
  const { data: champs } = useFetch<{ data: Champ[] }>("/api/v1/championships?status=active");
  const hasProjects = (projects?.data.length || 0) > 0;
  const freeLeft = user?.freeClipsLeft ?? 3;
  const activeChamps = champs?.data || [];
  const champ = activeChamps[champIdx % Math.max(1, activeChamps.length)];

  function go() {
    if (!url.trim()) return toast.error("Cole um link do YouTube");
    router.push(`/criar-projeto?url=${encodeURIComponent(url.trim())}`);
  }

  return (
    <Page wide>
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <p className="eyebrow">Seu estúdio</p>
          <h1 className="display mt-3 text-4xl md:text-5xl">{hasProjects ? "Sua bancada de criação." : "Seu primeiro corte começa aqui."}</h1>
          <p className="mt-4 text-muted-foreground">{hasProjects ? "Crie novos cortes ou abra um dos seus projetos recentes." : "Transforme seu vídeo em cortes prontos para compartilhar."}</p>
        </div>
        {champ ? (
          <div className="flex items-stretch overflow-hidden rounded-2xl border bg-card">
            <Link href="/campeonatos" className="flex flex-col justify-center border-r px-4 py-3">
              <span className="eyebrow !text-primary">R$/ Campeonatos</span>
              <span className="mt-1 font-mono text-xs text-muted-foreground">
                {(champIdx % activeChamps.length) + 1} / {activeChamps.length}
              </span>
            </Link>
            <Link href={`/campeonatos/${champ.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50">
              <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-secondary">
                {champ.bannerUrl ? <img src={champ.bannerUrl} alt="" className="size-full object-cover" /> : <Trophy className="m-3 size-5 text-primary" />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{champ.title}</p>
                <p className="text-xs text-muted-foreground">{champ.kind === "ranking" ? "premiação por ranking" : "pago por views"}</p>
              </div>
              <div className="ml-4 text-right">
                <p className="font-mono text-sm font-bold text-success">R$ {Math.round(champ.prizeTotal / 100 / 1000)}K</p>
                <p className="text-[10px] text-muted-foreground">em prêmios</p>
              </div>
              <ArrowUpRight className="size-4 text-muted-foreground" />
            </Link>
            <div className="flex items-center gap-1 border-l px-2">
              <button className="rounded-md p-1.5 hover:bg-secondary" onClick={() => setChampIdx((i) => (i - 1 + activeChamps.length) % activeChamps.length)}>
                <ChevronLeft className="size-4" />
              </button>
              <button className="rounded-md p-1.5 hover:bg-secondary" onClick={() => setChampIdx((i) => (i + 1) % activeChamps.length)}>
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mx-auto mt-10 max-w-4xl rounded-3xl border bg-card p-6 shadow-xl md:p-8">
        <p className="text-base font-semibold">{hasProjects ? "Vamos transformar seu conteúdo?" : "Qual vídeo vamos transformar?"}</p>
        {!user?.isSubscriber && freeLeft > 0 ? (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
            <Scissors className="size-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-primary">{freeLeft} cortes por nossa conta</p>
              <p className="text-xs text-muted-foreground">Cole um link do YouTube e experimente seus {freeLeft} primeiros cortes grátis.</p>
            </div>
          </div>
        ) : null}
        <div className="mt-4 border-b">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go()}
            placeholder="youtube.com/watch?v=…"
            className="h-14 w-full bg-transparent text-lg italic outline-none placeholder:text-muted-foreground/60"
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Link href="/criar-projeto?upload=1" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <Upload className="size-4" /> Envie seu arquivo
          </Link>
          <Button onClick={go} size="lg">
            <Sparkles /> Gerar Clipes
          </Button>
        </div>
      </div>

      {hasProjects ? (
        <>
          <div className="mx-auto mt-6 grid max-w-4xl gap-3 md:grid-cols-3">
            <Tile icon={<Scissors />} title="Cortes Automáticos" desc="Detecta automaticamente os melhores momentos" onClick={() => router.push("/criar-projeto")} />
            <Tile icon={<Video />} title="Reframe de Vídeo" desc="Mude o enquadramento do seu vídeo para qualquer formato" onClick={() => router.push("/criar-projeto?goal=reframe")} />
            <Tile icon={<Wand2 />} title="Projeto do zero" desc="Abra o editor e crie seu vídeo do zero" onClick={() => setBlankOpen(true)} accent />
          </div>
          <div className="mt-10 flex items-center justify-between">
            <h2 className="text-xl font-bold">Projetos recentes</h2>
            <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground">
              Todos os projetos →
            </Link>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects?.data.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="group overflow-hidden rounded-2xl border bg-card transition hover:border-primary/50">
                <div className="relative aspect-video bg-secondary">
                  {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt="" className="size-full object-cover" /> : null}
                  <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${p.status === "ready" ? "bg-success/90 text-black" : p.status === "failed" ? "bg-destructive text-white" : "bg-black/70 text-white"}`}>
                    {p.status === "ready" ? `${p.shortsCount} cortes` : p.status === "failed" ? "Falhou" : `${p.progress}% · ${p.stage ?? "processando"}`}
                  </span>
                  {p.expiresAt ? <span className="absolute right-2 top-2 rounded-full bg-destructive/80 px-2 py-0.5 text-[10px] font-bold text-white">{Math.max(0, Math.ceil((new Date(p.expiresAt).getTime() - Date.now()) / 86400000))}d</span> : null}
                  <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">{formatDuration(p.durationSec)}</span>
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-semibold group-hover:text-primary">{p.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{timeAgo(p.createdAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="mx-auto mt-8 grid max-w-4xl gap-6 md:grid-cols-3">
            <Step icon={<Video />} title="Escolha o vídeo" desc="Cole um link ou envie seu arquivo." />
            <Step icon={<Scissors />} title="Personalize o estilo" desc="Escolha o formato e as legendas." />
            <Step icon={<Check />} title="Receba seus cortes" desc="Edite, baixe ou agende a publicação." />
          </div>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Prefere começar do zero?{" "}
            <button className="text-primary hover:underline" onClick={() => setBlankOpen(true)}>
              Abrir editor →
            </button>
          </p>
        </>
      )}
      <BlankProjectDialog open={blankOpen} onOpenChange={setBlankOpen} />
    </Page>
  );
}

function Step({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-card text-muted-foreground [&_svg]:size-4">{icon}</span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function Tile({ icon, title, desc, onClick, accent }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void; accent?: boolean }) {
  return (
    <button onClick={onClick} className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-left transition hover:border-primary/50">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${accent ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary"} [&_svg]:size-4`}>{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <ArrowUpRight className={`size-4 ${accent ? "text-warning" : "text-primary"}`} />
    </button>
  );
}
