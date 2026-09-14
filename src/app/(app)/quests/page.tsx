"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarCheck, Check, Flame, Gift, Lock, Sparkles, Trophy, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { api, useFetch, useUser } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/progress";
import { Page } from "@/components/page-header";
import { Roulette } from "@/components/quests/roulette";

interface Mission {
  id: string;
  key: string;
  title: string;
  description: string;
  reward: number;
  kind: "daily" | "once";
  done: boolean;
  claimable: boolean;
  progress: { current: number; target: number };
  completedAt: string | null;
}
interface QuestsResp {
  missions: Mission[];
  checkedInToday: boolean;
  streak: number;
  today: string;
  checkinDays: string[];
  canSpin: boolean;
  nextSpinAt: string | null;
  spinRewards: number[];
  credits: number;
}

export default function QuestsPage() {
  const { user, loading } = useUser();
  if (loading || !user) {
    return (
      <Page>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-12 w-3/4" />
        <Skeleton className="mt-8 h-64 w-full" />
      </Page>
    );
  }
  if (!user.isSubscriber) return <QuestsPaywall />;
  return <QuestsContent />;
}

function QuestsPaywall() {
  const locked = [
    { icon: <CalendarCheck />, title: "Faça seu check-in", desc: "Volte todos os dias, confirme sua presença e receba créditos por manter o hábito." },
    { icon: <Flame />, title: "Construa sua sequência", desc: "Cada dia seguido de check-in soma na sua sequência. Ao completar 7 dias, um bônus extra é liberado." },
    { icon: <Trophy />, title: "Transforme conquistas em créditos", desc: "Criar projetos, renderizar cortes, montar seu Brand Kit e participar da comunidade rendem recompensas." },
    { icon: <Gift />, title: "Acesse a roleta", desc: "Um giro grátis por dia com prêmios de até 60 créditos para turbinar sua produção." },
  ];
  return (
    <Page>
      <div className="mx-auto max-w-3xl text-center">
        <Badge variant="purple" className="gap-1.5">
          <Lock className="size-3" /> Exclusivo para assinantes
        </Badge>
        <h1 className="display mt-6 text-4xl md:text-5xl">
          Suas próximas conquistas
          <br />
          <span className="text-primary">podem render recompensas.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-muted-foreground">
          No teste grátis, você experimenta a criação de cortes. Com uma assinatura ativa, também tem acesso às missões para ganhar créditos e acompanhar suas conquistas.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/financeiro?tab=plans">
            Ver planos e desbloquear missões <ArrowRight />
          </Link>
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">A compra de créditos avulsos não inclui o acesso às missões.</p>
      </div>

      <div className="mx-auto mt-14 max-w-4xl">
        <p className="eyebrow text-center">O que fica de fora sem uma assinatura</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {locked.map((l) => (
            <div key={l.title} className="flex items-start gap-4 rounded-2xl border bg-card p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary [&_svg]:size-5">{l.icon}</span>
              <div>
                <p className="font-semibold">{l.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{l.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">As missões e recompensas seguem as regras e a disponibilidade de cada atividade. Nenhum crédito é concedido apenas por assinar.</p>
      </div>
    </Page>
  );
}

function QuestsContent() {
  const { refresh } = useUser();
  const { data, reload, setData } = useFetch<QuestsResp>("/api/v1/quests");
  const [checking, setChecking] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);

  async function checkin() {
    setChecking(true);
    try {
      const res = await api<{ reward: number; streak: number; streakBonus: number | null }>("/api/v1/quests/checkin", { method: "POST" });
      toast.success(`Check-in feito! +${res.reward} créditos · sequência de ${res.streak} ${res.streak === 1 ? "dia" : "dias"}.`);
      if (res.streakBonus) toast.success(`Sequência de 7 dias completa: +${res.streakBonus} créditos!`);
      await Promise.all([reload(), refresh()]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  async function claim(m: Mission) {
    setClaiming(m.key);
    try {
      const res = await api<{ reward: number }>("/api/v1/quests/complete", { method: "POST", json: { key: m.key } });
      toast.success(`Missão concluída: +${res.reward} créditos!`);
      await Promise.all([reload(), refresh()]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setClaiming(null);
    }
  }

  const missions = data?.missions.filter((m) => m.key !== "checkin") || [];
  const doneCount = data?.missions.filter((m) => m.done).length ?? 0;
  const totalEarned = data?.missions.filter((m) => m.done).reduce((s, m) => s + m.reward, 0) ?? 0;

  return (
    <Page>
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-success" /> Ganhar · Missões
          </p>
          <h1 className="display mt-3 text-4xl md:text-5xl">
            Complete missões, <span className="text-primary">ganhe créditos.</span>
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">Check-in diário, sequências, conquistas e um giro grátis na roleta. Tudo vira crédito para os seus cortes.</p>
        </div>
        <div className="flex gap-3">
          <Stat label="Concluídas" value={data ? `${doneCount}/${data.missions.length}` : "…"} />
          <Stat label="Ganhos" value={data ? `+${totalEarned}` : "…"} accent />
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Check-in */}
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow !text-primary">Missão diária</p>
              <h2 className="mt-2 text-xl font-bold">Faça seu check-in</h2>
              <p className="mt-1 text-sm text-muted-foreground">Volte à área de missões todo dia para realizar o check-in e receber a recompensa.</p>
            </div>
            <Badge variant="purple" className="shrink-0">
              +5 créditos
            </Badge>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Flame className={cn("size-6", (data?.streak ?? 0) > 0 ? "text-warning" : "text-muted-foreground")} />
            <div>
              <p className="text-2xl font-black leading-none">
                {data?.streak ?? 0} <span className="text-sm font-medium text-muted-foreground">{data?.streak === 1 ? "dia seguido" : "dias seguidos"}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Complete 7 dias seguidos e ganhe +30 créditos de bônus.</p>
            </div>
          </div>

          <StreakCalendar streak={data?.streak ?? 0} checkedInToday={!!data?.checkedInToday} />

          <Button size="lg" className="mt-6 w-full" onClick={checkin} loading={checking} disabled={!data || data.checkedInToday}>
            {data?.checkedInToday ? (
              <>
                <Check /> Check-in de hoje concluído
              </>
            ) : (
              <>
                <CalendarCheck /> Fazer check-in de hoje
              </>
            )}
          </Button>
        </div>

        {/* Roleta */}
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow !text-primary">Giro de prêmios</p>
              <h2 className="mt-2 text-xl font-bold">Roleta diária</h2>
              <p className="mt-1 text-sm text-muted-foreground">Gire uma vez a cada 24h e ganhe de 5 a 60 créditos.</p>
            </div>
            <Sparkles className="size-5 shrink-0 text-primary" />
          </div>
          <div className="mt-6">
            {data ? (
              <Roulette
                rewards={data.spinRewards}
                canSpin={data.canSpin}
                nextSpinAt={data.nextSpinAt}
                onWin={() => {
                  setData({ ...data, canSpin: false, nextSpinAt: new Date(Date.now() + 86_400_000).toISOString() });
                  refresh();
                }}
              />
            ) : (
              <Skeleton className="mx-auto size-56 rounded-full" />
            )}
          </div>
        </div>
      </div>

      {/* Missões */}
      <div className="mt-10">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Conquistas</h2>
          <span className="eyebrow">{missions.filter((m) => m.done).length} de {missions.length} concluídas</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="mt-4 divide-y rounded-2xl border bg-card">
          {!data
            ? [1, 2, 3].map((i) => <Skeleton key={i} className="m-4 h-14" />)
            : missions.map((m) => (
                <div key={m.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", m.done ? "bg-success/15 text-success" : m.claimable ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>
                    {m.done ? <Check className="size-5" /> : <Trophy className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-semibold", m.done && "text-muted-foreground line-through decoration-muted-foreground/50")}>{m.title}</p>
                    <p className="text-sm text-muted-foreground">{m.description}</p>
                    {!m.done && m.progress.target > 1 ? (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(m.progress.current / m.progress.target) * 100}%` }} />
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {m.progress.current}/{m.progress.target}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <Badge variant={m.done ? "success" : "purple"} className="shrink-0 self-start md:self-center">
                    +{m.reward} créditos
                  </Badge>
                  <div className="shrink-0 md:w-36 md:text-right">
                    {m.done ? (
                      <span className="text-xs text-muted-foreground">Concluída</span>
                    ) : m.claimable ? (
                      <Button size="sm" onClick={() => claim(m)} loading={claiming === m.key}>
                        Resgatar
                      </Button>
                    ) : m.key === "streak7" ? (
                      <span className="text-xs text-muted-foreground">Automática ao completar</span>
                    ) : (
                      <Button asChild size="sm" variant="outline">
                        <Link href={missionHref(m.key)}>Ir para a missão</Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">As missões e recompensas seguem as regras e a disponibilidade de cada atividade. Missões únicas são resgatadas uma vez por conta.</p>
      </div>
    </Page>
  );
}

function missionHref(key: string) {
  switch (key) {
    case "first_project":
      return "/criar-projeto";
    case "first_render":
      return "/projects";
    case "brand_kit":
      return "/brand-kit";
    case "invite":
      return "/convidar";
    case "forum_post":
      return "/forum";
    case "schedule":
      return "/schedule";
    default:
      return "/dashboard";
  }
}

function StreakCalendar({ streak, checkedInToday }: { streak: number; checkedInToday: boolean }) {
  // 7 posições: as `streak` primeiras estão acesas; a próxima (hoje) fica destacada quando ainda não houve check-in.
  const filled = Math.min(7, streak);
  const todayIdx = checkedInToday ? -1 : Math.min(6, streak);
  return (
    <div className="mt-5 grid grid-cols-7 gap-2">
      {Array.from({ length: 7 }).map((_, i) => {
        const on = i < filled;
        const isToday = i === todayIdx;
        const last = i === 6;
        return (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-full border text-xs font-bold transition",
                on ? "border-primary bg-primary text-primary-foreground" : isToday ? "border-primary border-dashed text-primary" : "border-border text-muted-foreground/60",
                last && !on && "border-warning/60 text-warning",
              )}
            >
              {on ? <Check className="size-4" /> : last ? <Gift className="size-4" /> : i + 1}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{last ? "+30" : `Dia ${i + 1}`}</span>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-24 rounded-2xl border bg-card px-4 py-3">
      <p className="eyebrow">{label}</p>
      <p className={cn("mt-1 font-mono text-xl font-bold", accent && "text-success")}>{value}</p>
    </div>
  );
}
