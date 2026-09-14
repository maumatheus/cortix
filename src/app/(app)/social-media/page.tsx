"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Lock, Plus, Share2, Trophy, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, useFetch, useUser } from "@/lib/hooks";
import { timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Page, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlatformDot, platformInfo } from "@/components/shared/platform";
import { ConnectAccountDialog, type SocialAccountItem } from "@/components/social/connect-account-dialog";

const SEEN_KEY = "cf_social_purpose_seen";

export default function SocialMediaPage() {
  const { user } = useUser();
  const { data, loading, reload } = useFetch<{ data: SocialAccountItem[]; limit: number; plan: string | null; isSubscriber: boolean }>("/api/v1/social-accounts?purpose=publish");
  const [purposeOpen, setPurposeOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setPurposeOpen(true);
    } catch {
      setPurposeOpen(true);
    }
  }, []);

  function dismissPurpose() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    setPurposeOpen(false);
  }

  async function remove(a: SocialAccountItem) {
    if (!confirm(`Desconectar ${a.handle}? Os posts agendados nessa conta continuam, mas sem conta vinculada.`)) return;
    try {
      await api(`/api/v1/social-accounts/${a.id}`, { method: "DELETE" });
      toast.success("Conta desconectada");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const accounts = data?.data ?? [];
  const limit = data?.limit ?? 0;
  const isSubscriber = user?.isSubscriber ?? data?.isSubscriber ?? false;

  return (
    <Page>
      <PageHeader eyebrow="Publicar · Contas" dot title="Redes Sociais" description="Conecte suas contas pra agendar e publicar cortes direto do Cortix." />

      <div className="flex flex-col gap-4 rounded-2xl border border-warning/30 bg-warning/5 p-5 md:flex-row md:items-center">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
          <Trophy className="size-6" />
        </div>
        <div className="flex-1">
          <p className="eyebrow !text-warning">Campeonatos</p>
          <p className="mt-1 text-sm font-semibold">Vai enviar vídeos para um campeonato?</p>
          <p className="text-xs text-muted-foreground">Essas contas são configuradas em uma área separada das contas usadas para publicar seus cortes.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/campeonatos">
            Conectar conta para campeonatos <ArrowRight />
          </Link>
        </Button>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Contas de publicação</p>
            <h2 className="mt-1 text-lg font-semibold">Suas redes conectadas</h2>
            {isSubscriber ? (
              <p className="text-xs text-muted-foreground">
                Plano {data?.plan ?? user?.plan} · {accounts.length} de {limit} {limit === 1 ? "conta" : "contas"} usadas
              </p>
            ) : null}
          </div>
          {isSubscriber ? (
            <Button onClick={() => setConnectOpen(true)} disabled={accounts.length >= limit}>
              <Plus /> Conectar conta
            </Button>
          ) : null}
        </div>

        {!isSubscriber ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border bg-card px-6 py-16 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Lock className="size-8" />
            </div>
            <p className="text-lg font-semibold">Disponível apenas para assinantes</p>
            <p className="max-w-md text-sm text-muted-foreground">Conecte suas redes e publique seus cortes direto do Cortix. Assine um plano pra liberar.</p>
            <p className="text-[11px] text-muted-foreground">Lite: 1 conta · Creator: 3 contas · Viral: 6 contas</p>
            <Button asChild className="mt-2">
              <Link href="/financeiro?tab=plans">Ver planos</Link>
            </Button>
          </div>
        ) : loading && !data ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState icon={<Share2 />} title="Nenhuma conta conectada" description="Conecte YouTube, Instagram ou TikTok pra agendar e publicar seus cortes." action={<Button onClick={() => setConnectOpen(true)}><Plus /> Conectar conta</Button>} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
                <PlatformDot platform={a.platform} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{a.handle}</p>
                  <p className="text-xs text-muted-foreground">
                    {platformInfo(a.platform).name} · conectada há {timeAgo(a.createdAt)}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-success">
                    <span className="size-1.5 rounded-full bg-success" /> Ativa · {a.postsCount ?? 0} posts
                  </p>
                </div>
                <button className="rounded-lg border p-2 text-destructive hover:bg-destructive/10" title="Desconectar" onClick={() => remove(a)}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            {accounts.length < limit ? (
              <button onClick={() => setConnectOpen(true)} className="flex min-h-24 items-center justify-center gap-2 rounded-2xl border border-dashed text-sm text-muted-foreground transition hover:border-primary hover:text-foreground">
                <Plus className="size-4" /> Conectar mais uma ({limit - accounts.length} restante{limit - accounts.length === 1 ? "" : "s"})
              </button>
            ) : null}
          </div>
        )}
      </div>

      <Dialog open={purposeOpen} onOpenChange={(v) => (v ? setPurposeOpen(true) : dismissPurpose())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <p className="eyebrow">Antes de conectar</p>
            <DialogTitle>Qual é o objetivo desta conta?</DialogTitle>
            <DialogDescription>As contas de publicação e de campeonatos são gerenciadas em áreas diferentes. Escolha o que você quer fazer agora.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={dismissPurpose} className="group flex flex-col gap-3 rounded-2xl border p-5 text-left transition hover:border-primary hover:bg-primary/5">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Upload className="size-5" />
              </span>
              <span>
                <span className="block text-base font-semibold">Publicar meus cortes</span>
                <span className="mt-1 block text-xs text-muted-foreground">Agendar, usar launchers e publicar direto do Cortix.</span>
              </span>
              <span className="eyebrow mt-auto flex items-center gap-2 !text-primary">
                Continuar nesta tela <ArrowRight className="size-3 transition group-hover:translate-x-1" />
              </span>
            </button>
            <Link href="/campeonatos" onClick={dismissPurpose} className="group flex flex-col gap-3 rounded-2xl border p-5 text-left transition hover:border-warning hover:bg-warning/5">
              <span className="flex size-11 items-center justify-center rounded-xl bg-warning/15 text-warning">
                <Trophy className="size-5" />
              </span>
              <span>
                <span className="block text-base font-semibold">Participar de campeonatos</span>
                <span className="mt-1 block text-xs text-muted-foreground">Validar sua conta pra concorrer às premiações.</span>
              </span>
              <span className="eyebrow mt-auto flex items-center gap-2 !text-warning">
                Ir para contas de campeonatos <ArrowRight className="size-3 transition group-hover:translate-x-1" />
              </span>
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      <ConnectAccountDialog open={connectOpen} onOpenChange={setConnectOpen} purpose="publish" onConnected={reload} />
    </Page>
  );
}
