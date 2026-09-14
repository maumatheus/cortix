"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, ChevronDown, ChevronUp, Clock, Coins, CreditCard, Droplets, Plus, QrCode, Receipt, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";
import { api, useFetch, useUser } from "@/lib/hooks";
import { cn, creditsToHours, formatBRL } from "@/lib/utils";
import { CREDIT_PRICE_CENTS, PACKAGE_MAX, PACKAGE_MIN, PACKAGE_PRESETS, PLAN_FEATURES, PLANS, getPlan, packagePriceCents, type Plan } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Page } from "@/components/page-header";
import { CheckoutDialog, type CheckoutItem, type PayMethod } from "@/components/financeiro/checkout-dialog";

const TABS = ["overview", "plans", "packages", "history"] as const;
type Tab = (typeof TABS)[number];

export default function FinanceiroPage() {
  return (
    <Suspense>
      <Financeiro />
    </Suspense>
  );
}

function Financeiro() {
  const sp = useSearchParams();
  const router = useRouter();
  const raw = sp.get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(raw || "") ? (raw as Tab) : "overview";
  const [checkout, setCheckout] = useState<{ item: CheckoutItem; method: PayMethod } | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  function setTab(t: string) {
    router.replace(`/financeiro?tab=${t}`, { scroll: false });
  }

  return (
    <Page>
      <p className="eyebrow flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-success" /> Ganhar · Financeiro
      </p>
      <h1 className="display mt-3 text-4xl md:text-5xl">
        Créditos, planos <span className="text-primary">e pagamentos.</span>
      </h1>

      <Tabs value={tab} onValueChange={setTab} className="mt-8">
        <TabsList className="w-full max-w-2xl">
          <TabsTrigger value="overview">
            <Wallet /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="plans">
            <Sparkles /> Planos
          </TabsTrigger>
          <TabsTrigger value="packages">
            <Coins /> Pacotes
          </TabsTrigger>
          <TabsTrigger value="history">
            <Receipt /> Histórico
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Overview onAddCredits={() => setTab("packages")} onPlans={() => setTab("plans")} />
        </TabsContent>
        <TabsContent value="plans">
          <PlansTab onSubscribe={(planId, cycle, method) => setCheckout({ item: { kind: "plan", planId, cycle }, method })} />
        </TabsContent>
        <TabsContent value="packages">
          <PackagesTab onBuy={(credits, method) => setCheckout({ item: { kind: "package", credits }, method })} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab key={historyKey} highlightOrder={sp.get("order")} cardNotice={sp.get("card") === "1"} />
        </TabsContent>
      </Tabs>

      <CheckoutDialog open={!!checkout} onOpenChange={(v) => !v && setCheckout(null)} item={checkout?.item ?? null} defaultMethod={checkout?.method} onPaid={() => setHistoryKey((k) => k + 1)} />
    </Page>
  );
}

/* ───────────────────────────── Visão Geral ───────────────────────────── */

function Overview({ onAddCredits, onPlans }: { onAddCredits: () => void; onPlans: () => void }) {
  const { user } = useUser();
  const plan = getPlan(user?.plan);
  const active = !!user?.isSubscriber && !!plan;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="glow rounded-2xl border bg-card p-6">
        <p className="eyebrow">Saldo Disponível</p>
        {user ? (
          <>
            <p className="mt-3 text-5xl font-black tracking-tight">
              {user.credits.toLocaleString("pt-BR")} <span className="text-lg font-semibold text-muted-foreground">créditos</span>
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4" /> ≈ {creditsToHours(user.credits)} horas de vídeo
            </p>
          </>
        ) : (
          <Skeleton className="mt-3 h-12 w-48" />
        )}
        <Button className="mt-6" onClick={onAddCredits}>
          <Plus /> Adicionar Créditos
        </Button>
        <p className="mt-3 text-[11px] text-muted-foreground">60 créditos = 1 hora de vídeo analisado. Seus créditos nunca expiram.</p>
      </div>

      {active && plan ? (
        <div className="rounded-2xl border bg-card p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="eyebrow">Plano atual</p>
              <p className="mt-3 text-3xl font-black">Plano {plan.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
            </div>
            <Badge variant="success">Ativo</Badge>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <Info label="Ciclo" value={user?.planCycle === "yearly" ? "Anual" : "Mensal"} />
            <Info label="Renova em" value={user?.planRenewsAt ? new Date(user.planRenewsAt).toLocaleDateString("pt-BR") : "—"} />
            <Info label="Créditos por mês" value={plan.credits.toLocaleString("pt-BR")} />
            <Info label="Redes sociais" value={String(plan.socials)} />
          </dl>
          <Button variant="outline" className="mt-5" onClick={onPlans}>
            Trocar de plano <ArrowRight />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card/40 px-6 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Sparkles className="size-7" />
          </span>
          <p className="text-base font-semibold">Nenhum plano ativo</p>
          <p className="max-w-sm text-sm text-muted-foreground">Assine um plano para ter acesso a mais recursos e créditos mensais.</p>
          <Button className="mt-2" onClick={onPlans}>
            Ver Planos
          </Button>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background/40 px-3 py-2">
      <dt className="eyebrow !text-[10px]">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

/* ───────────────────────────── Planos ───────────────────────────── */

const HIGHLIGHTS: Record<Plan["id"], string[]> = {
  lite: ["Sem marca d'água em todos os cortes", "Legendas automáticas com IA", "Check-in diário e roleta de prêmios", "Programa de afiliados"],
  creator: ["Tudo do Lite", "Postagem automática nas redes", "Monitoramento de lives", "Auto Edit com IA"],
  viral: ["Tudo do Creator", "Clipes em até 4K", "Hooks/B-rolls premium", "Acesso à API"],
};

function PlansTab({ onSubscribe }: { onSubscribe: (planId: Plan["id"], cycle: "monthly" | "yearly", method: PayMethod) => void }) {
  const { user } = useUser();
  const [yearly, setYearly] = useState(false);
  const cycle = yearly ? "yearly" : "monthly";

  return (
    <div>
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-5 py-4 sm:flex-row sm:justify-between">
        <div>
          <p className="font-semibold">Escolha o ciclo de cobrança</p>
          <p className="text-xs text-muted-foreground">No anual você paga 12 meses de uma vez com desconto.</p>
        </div>
        <label className="flex items-center gap-3 text-sm font-medium">
          <span className={cn(!yearly ? "text-foreground" : "text-muted-foreground")}>Mensal</span>
          <Switch checked={yearly} onCheckedChange={setYearly} />
          <span className={cn(yearly ? "text-foreground" : "text-muted-foreground")}>Anual</span>
          <Badge variant="success" className="ml-1">
            até 20% off
          </Badge>
        </label>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {PLANS.map((p) => (
          <PlanCard key={p.id} plan={p} yearly={yearly} current={user?.isSubscriber && user.plan === p.id} onSubscribe={(m) => onSubscribe(p.id, cycle, m)} />
        ))}
      </div>

      <div className="mt-10 rounded-2xl border bg-card p-6">
        <p className="eyebrow">Todos os planos incluem</p>
        <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {PLAN_FEATURES.map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm">
              <Check className="size-4 shrink-0 text-success" /> {f}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">Seus créditos nunca expiram. Caso seus créditos acabem, você pode comprar créditos extras avulsos sem precisar mudar de plano.</p>
    </div>
  );
}

function PlanCard({ plan, yearly, current, onSubscribe }: { plan: Plan; yearly: boolean; current?: boolean; onSubscribe: (method: PayMethod) => void }) {
  const [expanded, setExpanded] = useState(false);
  const monthly = yearly ? plan.yearlyCents : plan.monthlyCents;
  return (
    <div className={cn("relative flex flex-col rounded-2xl border bg-card p-6", plan.popular && "glow border-primary/60")}>
      {plan.popular ? <Badge className="absolute -top-3 left-6">Mais Popular</Badge> : null}
      {current ? (
        <Badge variant="success" className="absolute -top-3 right-6">
          Seu plano
        </Badge>
      ) : null}
      <p className="text-xl font-bold">{plan.name}</p>
      <p className="mt-1 text-xs text-muted-foreground">{plan.tagline}</p>
      <p className="mt-5">
        <span className="text-4xl font-black tracking-tight">{formatBRL(monthly)}</span>
        <span className="text-sm text-muted-foreground">/mês</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{yearly ? `${formatBRL(plan.yearlyCents * 12)} cobrados anualmente` : "Cancele a qualquer momento."}</p>
      {yearly ? <p className="text-xs text-muted-foreground">Cancele a qualquer momento.</p> : null}

      <Button size="lg" className="mt-5 w-full" variant={plan.popular ? "default" : "secondary"} onClick={() => onSubscribe("card")}>
        Assinar o {plan.name}
      </Button>
      <button onClick={() => onSubscribe("pix")} className="mt-2 flex items-center justify-center gap-1.5 text-xs text-primary hover:underline">
        <QrCode className="size-3.5" /> Prefere PIX?
      </button>

      <div className="mt-6 rounded-xl border bg-background/40 p-4">
        <p className="eyebrow !text-[10px]">Capacidade mensal</p>
        <ul className="mt-2 space-y-1.5 text-sm">
          <li className="flex justify-between">
            <span className="text-muted-foreground">Créditos</span>
            <span className="font-mono font-semibold">{plan.credits.toLocaleString("pt-BR")}</span>
          </li>
          <li className="flex justify-between">
            <span className="text-muted-foreground">Horas de vídeo</span>
            <span className="font-mono font-semibold">{plan.hours}h</span>
          </li>
          <li className="flex justify-between">
            <span className="text-muted-foreground">Redes sociais</span>
            <span className="font-mono font-semibold">
              {plan.socials} {plan.socials === 1 ? "rede" : "redes"}
            </span>
          </li>
        </ul>
      </div>

      <p className="eyebrow mt-5 !text-[10px]">Destaques do plano</p>
      <ul className="mt-2 space-y-1.5">
        {HIGHLIGHTS[plan.id].map((h) => (
          <li key={h} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {h}
          </li>
        ))}
      </ul>
      <button onClick={() => setExpanded((v) => !v)} className="mt-3 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
        {expanded ? "Ocultar recursos" : "Ver todos os recursos"} {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        {!expanded ? <span className="text-primary">+</span> : null}
      </button>
      {expanded ? (
        <ul className="mt-3 space-y-1 border-t pt-3">
          {PLAN_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Check className="mt-0.5 size-3 shrink-0 text-success" /> {f}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ───────────────────────────── Pacotes ───────────────────────────── */

function PackagesTab({ onBuy }: { onBuy: (credits: number, method: PayMethod) => void }) {
  const [credits, setCredits] = useState(300);
  const [method, setMethod] = useState<PayMethod>("pix");
  const clamped = Math.min(PACKAGE_MAX, Math.max(PACKAGE_MIN, credits || PACKAGE_MIN));
  const pix = packagePriceCents(clamped, "pix");
  const card = packagePriceCents(clamped, "card");

  return (
    <div>
      <div className="flex gap-3 rounded-2xl border border-primary/40 bg-primary/5 px-5 py-4">
        <Droplets className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold">Pacotes de créditos removem a marca d&apos;água</p>
          <p className="mt-1 text-xs text-muted-foreground">Cortes feitos com créditos são exportados sem marca d&apos;água. Para clipes de lives sem marca d&apos;água, é necessário um plano ativo.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-2xl border bg-card p-6">
          <p className="text-xl font-bold">Recarga de Créditos</p>
          <p className="mt-1 text-sm text-muted-foreground">Escolha livremente quantos créditos deseja recarregar (60 créditos = 1 hora).</p>

          <p className="eyebrow mt-6">Monte sua recarga</p>
          <div className="mt-3 flex items-center gap-3">
            <Input
              type="number"
              min={PACKAGE_MIN}
              max={PACKAGE_MAX}
              step={10}
              value={credits}
              onChange={(e) => setCredits(Number(e.target.value))}
              onBlur={() => setCredits(clamped)}
              className="w-32 font-mono text-lg font-bold"
            />
            <span className="text-sm text-muted-foreground">créditos</span>
          </div>
          <input type="range" min={PACKAGE_MIN} max={PACKAGE_MAX} step={10} value={clamped} onChange={(e) => setCredits(Number(e.target.value))} className="mt-4 w-full accent-[var(--primary)]" />
          <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>{PACKAGE_MIN}</span>
            <span>{PACKAGE_MAX}</span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {PACKAGE_PRESETS.map((p) => (
              <button key={p} onClick={() => setCredits(p)} className={cn("rounded-xl border px-3 py-2 text-center transition hover:border-primary/50", clamped === p && "border-primary bg-primary/10")}>
                <span className="block font-mono text-sm font-bold">{p}</span>
                <span className="block text-[11px] text-muted-foreground">· {p / 60}h</span>
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between rounded-xl border bg-background/40 px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4" /> Tempo de vídeo
            </span>
            <span className="font-mono font-bold">{creditsToHours(clamped)} horas</span>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Preço base de {formatBRL(CREDIT_PRICE_CENTS)} por crédito no Pix.</p>
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <p className="text-xl font-bold">Como você quer pagar?</p>
          <p className="mt-1 text-sm text-muted-foreground">O preço e o desconto são confirmados diretamente pelo servidor.</p>
          <div className="mt-5 space-y-2">
            <PayOption active={method === "pix"} onClick={() => setMethod("pix")} icon={<QrCode />} title="Pix" desc="Aprovação imediata · 5% off" price={formatBRL(pix)} />
            <PayOption active={method === "card"} onClick={() => setMethod("card")} icon={<CreditCard />} title="Cartão" desc="Crédito ou débito" price="Valor final na Stripe" hint={`≈ ${formatBRL(card)}`} />
          </div>
          <Button size="lg" className="mt-5 w-full" onClick={() => onBuy(clamped, method)}>
            Continuar com {method === "pix" ? "Pix" : "Cartão"} <ArrowRight />
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5" /> Pagamento seguro. Créditos liberados na confirmação.
          </p>
        </div>
      </div>
    </div>
  );
}

function PayOption({ active, onClick, icon, title, desc, price, hint }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string; price: string; hint?: string }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:border-primary/50", active && "border-primary bg-primary/10")}>
      <span className={cn("flex size-10 items-center justify-center rounded-lg bg-secondary [&_svg]:size-4", active && "bg-primary/20 text-primary")}>{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{desc}</span>
      </span>
      <span className="text-right">
        <span className="block text-sm font-bold">{price}</span>
        {hint ? <span className="block text-[11px] text-muted-foreground">{hint}</span> : null}
      </span>
    </button>
  );
}

/* ───────────────────────────── Histórico ───────────────────────────── */

interface Tx {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}
interface Order {
  id: string;
  kind: string;
  planId: string | null;
  cycle: string | null;
  credits: number;
  amountCents: number;
  method: string;
  status: string;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  purchase: "Compra",
  plan: "Assinatura",
  referral: "Indicação",
  checkin: "Check-in",
  mission: "Missão",
  survey: "Pesquisa",
  usage: "Uso",
  refund: "Estorno",
  spin: "Roleta",
  bonus: "Bônus",
};

function HistoryTab({ highlightOrder, cardNotice }: { highlightOrder: string | null; cardNotice: boolean }) {
  const { refresh } = useUser();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, loading, reload } = useFetch<{ data: Tx[]; total: number; lastPage: number }>(`/api/v1/credits?page=${page}&limit=20`);
  const { data: pending, reload: reloadPending } = useFetch<{ data: Order[] }>("/api/v1/orders?status=pending&limit=10");
  const [confirming, setConfirming] = useState<string | null>(null);

  async function confirm(o: Order) {
    setConfirming(o.id);
    try {
      const res = await api<{ creditsAdded: number }>(`/api/v1/orders/${o.id}/confirm`, { method: "POST" });
      toast.success(`Pagamento confirmado: +${res.creditsAdded} créditos.`);
      await Promise.all([reloadPending(), reload(), refresh()]);
      if (cardNotice || highlightOrder) router.replace("/financeiro?tab=history", { scroll: false });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setConfirming(null);
    }
  }

  const items = data?.data || [];
  const pendingOrders = pending?.data || [];

  return (
    <div>
      {cardNotice ? (
        <div className="mb-4 flex gap-3 rounded-2xl border border-warning/40 bg-warning/5 px-5 py-4">
          <CreditCard className="mt-0.5 size-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-semibold">Checkout com cartão simulado</p>
            <p className="mt-1 text-xs text-muted-foreground">Nenhuma chave da Stripe está configurada. Confirme o pedido pendente abaixo para simular a aprovação do pagamento.</p>
          </div>
        </div>
      ) : null}

      {pendingOrders.length > 0 ? (
        <div className="mb-6">
          <p className="eyebrow">Pedidos pendentes</p>
          <div className="mt-3 divide-y rounded-2xl border bg-card">
            {pendingOrders.map((o) => (
              <div key={o.id} className={cn("flex flex-col gap-3 p-4 md:flex-row md:items-center", highlightOrder === o.id && "bg-primary/5")}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{o.kind === "plan" ? `Plano ${getPlan(o.planId)?.name ?? o.planId} · ${o.cycle === "yearly" ? "anual" : "mensal"}` : `Recarga de ${o.credits} créditos`}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBRL(o.amountCents)} · {o.method === "pix" ? "Pix" : "Cartão"} · {new Date(o.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <Badge variant="warning">Aguardando pagamento</Badge>
                <Button size="sm" onClick={() => confirm(o)} loading={confirming === o.id}>
                  Confirmar pagamento (simulação)
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <p className="font-semibold">Histórico de Transações</p>
          <span className="eyebrow">{data?.total ?? 0} registros</span>
        </div>
        {loading && !data ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <Receipt className="size-8 text-muted-foreground" />
            <p className="font-semibold">Nenhuma transação encontrada</p>
            <p className="text-sm text-muted-foreground">Compras, missões e uso de créditos aparecem aqui.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="eyebrow px-5 py-3 font-normal">Data</th>
                  <th className="eyebrow px-5 py-3 font-normal">Descrição</th>
                  <th className="eyebrow px-5 py-3 text-right font-normal">Créditos</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((t) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-5 py-3">
                      <span className="mr-2 rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{TYPE_LABEL[t.type] ?? t.type}</span>
                      {t.description}
                    </td>
                    <td className={cn("whitespace-nowrap px-5 py-3 text-right font-mono font-bold", t.amount >= 0 ? "text-success" : "text-destructive")}>
                      {t.amount >= 0 ? "+" : "−"}
                      {Math.abs(t.amount).toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.lastPage > 1 ? (
          <div className="flex items-center justify-between border-t px-5 py-3 text-sm">
            <span className="text-muted-foreground">
              Página {page} de {data.lastPage}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= data.lastPage} onClick={() => setPage((p) => p + 1)}>
                Próximo
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
