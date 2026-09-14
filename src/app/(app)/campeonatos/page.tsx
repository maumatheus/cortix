"use client";

import { useState } from "react";
import { Link2, Trophy, Wallet } from "lucide-react";
import { useFetch } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/progress";
import { Page, PageHeader } from "@/components/page-header";
import { ChampionshipCard } from "@/components/championships/championship-card";
import { AccountsDialog, PixDialog, RequirementsNotice } from "@/components/championships/setup";
import type { Championship, ChampionshipsResponse } from "@/components/championships/types";

export default function CampeonatosPage() {
  const { data, loading, reload } = useFetch<ChampionshipsResponse>("/api/v1/championships?status=all");
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [pixOpen, setPixOpen] = useState(false);

  const all = data?.data || [];
  const req = data?.requirements;
  const cpm = all.filter((c) => c.kind === "cpm" && c.status !== "finished");
  const ranking = all.filter((c) => c.kind === "ranking" && c.status !== "finished");
  const finished = all.filter((c) => c.status === "finished");

  function configure() {
    if (req && !req.pixKey) setPixOpen(true);
    else setAccountsOpen(true);
  }

  return (
    <Page wide>
      <PageHeader
        eyebrow="R$ · Campeonatos de cortes"
        dot
        title="Campeonatos"
        description="Explore os campeonatos de cortes disponíveis"
        actions={
          <>
            <Button variant="outline" onClick={() => setAccountsOpen(true)}>
              <Link2 /> Contas conectadas
            </Button>
            <Button variant="outline" onClick={() => setPixOpen(true)}>
              <Wallet /> Chave PIX
            </Button>
          </>
        }
      />

      {req ? <RequirementsNotice requirements={req} onConfigure={configure} className="mb-8" /> : null}

      {loading && !data ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : all.length === 0 ? (
        <EmptyState icon={<Trophy />} title="Nenhum campeonato disponível" description="Assim que um organizador abrir uma edição, ela aparece aqui." />
      ) : (
        <div className="space-y-12">
          <Section title="Pagos por views" items={cpm} hint="Você recebe por cada 1.000 views válidas até o orçamento acabar." />
          <Section title="Premiação por ranking" items={ranking} hint="Os creators com mais views ganhas dividem a premiação no fim da edição." />
          <Section title="Encerrados" items={finished} />
        </div>
      )}

      <AccountsDialog open={accountsOpen} onOpenChange={setAccountsOpen} onChanged={reload} />
      <PixDialog open={pixOpen} onOpenChange={setPixOpen} onSaved={reload} />
    </Page>
  );
}

function Section({ title, items, hint }: { title: string; items: Championship[]; hint?: string }) {
  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">
            {title} <span className="ml-1 font-mono text-sm font-normal text-muted-foreground">({items.length})</span>
          </h2>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">Nenhum campeonato nesta categoria no momento.</p>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => (
            <ChampionshipCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </section>
  );
}
