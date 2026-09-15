"use client";

import { useEffect, useState } from "react";
import { Check, Copy, CreditCard, QrCode, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, useUser } from "@/lib/hooks";
import { cn, formatBRL, creditsToHours } from "@/lib/utils";
import { getPlan, packagePriceCents } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type CheckoutItem = { kind: "package"; credits: number } | { kind: "plan"; planId: "lite" | "creator" | "viral"; cycle: "monthly" | "yearly" };
export type PayMethod = "pix" | "card";

interface Order {
  id: string;
  kind: string;
  credits: number;
  amountCents: number;
  method: string;
  status: string;
  pixCode: string | null;
}

export function itemPriceCents(item: CheckoutItem, method: PayMethod) {
  if (item.kind === "package") return packagePriceCents(item.credits, method);
  const plan = getPlan(item.planId)!;
  return item.cycle === "yearly" ? plan.yearlyCents * 12 : plan.monthlyCents;
}

export function itemLabel(item: CheckoutItem) {
  if (item.kind === "package") return `Recarga de ${item.credits} créditos`;
  const plan = getPlan(item.planId)!;
  return `Plano ${plan.name} · ${item.cycle === "yearly" ? "anual" : "mensal"}`;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  item,
  defaultMethod = "pix",
  onPaid,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: CheckoutItem | null;
  defaultMethod?: PayMethod;
  onPaid?: () => void;
}) {
  const { refresh } = useUser();
  const [method, setMethod] = useState<PayMethod>(defaultMethod);
  const [order, setOrder] = useState<Order | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [paid, setPaid] = useState<{ creditsAdded: number; referral: { share: number } | null } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setMethod(defaultMethod);
      setOrder(null);
      setPaid(null);
      setCopied(false);
    }
  }, [open, defaultMethod]);

  if (!item) return null;
  const credits = item.kind === "package" ? item.credits : getPlan(item.planId)!.credits;

  async function createOrder() {
    setCreating(true);
    try {
      const payload = item!.kind === "package" ? { kind: "package", credits: item!.credits, method } : { kind: "plan", planId: item!.planId, cycle: item!.cycle, method };
      const res = await api<{ order: Order; checkoutUrl?: string }>("/api/v1/orders", { method: "POST", json: payload });
      setOrder(res.order);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function confirm() {
    if (!order) return;
    setConfirming(true);
    try {
      const res = await api<{ creditsAdded: number; referral: { share: number } | null }>(`/api/v1/orders/${order.id}/confirm`, { method: "POST" });
      setPaid({ creditsAdded: res.creditsAdded, referral: res.referral });
      await refresh();
      onPaid?.();
      toast.success(`Pagamento confirmado! +${res.creditsAdded} créditos.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setConfirming(false);
    }
  }

  async function copy() {
    if (!order?.pixCode) return;
    try {
      await navigator.clipboard.writeText(order.pixCode);
      setCopied(true);
      toast.success("Código PIX copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {paid ? (
          <>
            <DialogHeader>
              <DialogTitle>Pagamento confirmado</DialogTitle>
              <DialogDescription>Seus créditos já estão disponíveis na sua conta.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-success/40 bg-success/5 px-6 py-8 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
                <Check className="size-7" />
              </span>
              <p className="text-3xl font-black">+{paid.creditsAdded} créditos</p>
              <p className="text-sm text-muted-foreground">{itemLabel(item)}</p>
              {paid.referral ? <p className="mt-2 text-xs text-primary">Bônus de indicação: +{paid.referral.share} créditos para você e para quem te convidou.</p> : null}
            </div>
            <Button className="mt-4 w-full" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </>
        ) : !order ? (
          <>
            <DialogHeader>
              <DialogTitle>Finalizar compra</DialogTitle>
              <DialogDescription>{itemLabel(item)}</DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Créditos</span>
                <span className="font-mono text-sm font-semibold">
                  {credits.toLocaleString("pt-BR")} <span className="text-muted-foreground">≈ {creditsToHours(credits)}h</span>
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-xl font-black">{formatBRL(itemPriceCents(item, method))}</span>
              </div>
            </div>
            <p className="eyebrow mt-5">Forma de pagamento</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <MethodOption active={method === "pix"} onClick={() => setMethod("pix")} icon={<QrCode />} title="Pix" desc={item.kind === "package" ? "5% de desconto" : "Aprovação imediata"} />
              <MethodOption active={method === "card"} onClick={() => setMethod("card")} icon={<CreditCard />} title="Cartão" desc="Valor final na Stripe" />
            </div>
            <Button className="mt-5 w-full" size="lg" loading={creating} onClick={createOrder}>
              Continuar com {method === "pix" ? "Pix" : "Cartão"}
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="size-3.5" /> O preço e o desconto são confirmados pelo servidor.
            </p>
          </>
        ) : order.method === "pix" ? (
          <>
            <DialogHeader>
              <DialogTitle>Pague com Pix</DialogTitle>
              <DialogDescription>Copie o código abaixo e pague no app do seu banco. {formatBRL(order.amountCents)}.</DialogDescription>
            </DialogHeader>
            <div className="mx-auto flex size-40 items-center justify-center rounded-2xl border bg-white p-3">
              <FakeQr seed={order.id} />
            </div>
            <p className="eyebrow mt-5">Pix copia e cola</p>
            <div className="mt-2 max-h-24 overflow-auto rounded-lg border bg-background/60 p-3 font-mono text-[11px] leading-relaxed break-all text-muted-foreground">{order.pixCode}</div>
            <Button variant="secondary" className="mt-3 w-full" onClick={copy}>
              {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar código PIX"}
            </Button>
            <div className="mt-4 rounded-xl border border-warning/40 bg-warning/5 p-3 text-xs text-muted-foreground">
              <strong className="text-warning">Ambiente de simulação.</strong> Nenhum gateway está configurado. Clique abaixo para simular a confirmação do pagamento (em produção isso é feito por webhook).
            </div>
            <Button className="mt-3 w-full" size="lg" loading={confirming} onClick={confirm}>
              Já paguei · Confirmar pagamento (simulação)
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Checkout com cartão</DialogTitle>
              <DialogDescription>Total de {formatBRL(order.amountCents)}. Sem chave da Stripe configurada, o checkout é simulado.</DialogDescription>
            </DialogHeader>
            <div className="rounded-2xl border bg-gradient-to-br from-[color:var(--brand-from)]/25 via-card to-[color:var(--brand-to)]/20 p-5">
              <p className="eyebrow">Cartão de crédito</p>
              <p className="mt-6 font-mono text-lg tracking-[0.2em]">•••• •••• •••• 4242</p>
              <div className="mt-4 flex justify-between font-mono text-xs text-muted-foreground">
                <span>Cortix TESTE</span>
                <span>12/34</span>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-warning/40 bg-warning/5 p-3 text-xs text-muted-foreground">
              <strong className="text-warning">Ambiente de simulação.</strong> Clique abaixo para simular a aprovação do cartão.
            </div>
            <Button className="mt-3 w-full" size="lg" loading={confirming} onClick={confirm}>
              Confirmar pagamento (simulação)
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MethodOption({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-3 rounded-xl border p-3 text-left transition hover:border-primary/50", active && "border-primary bg-primary/10")}>
      <span className={cn("flex size-9 items-center justify-center rounded-lg bg-secondary [&_svg]:size-4", active && "bg-primary/20 text-primary")}>{icon}</span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}

/** QR decorativo determinístico (não é um QR válido; a simulação usa o copia e cola). */
function FakeQr({ seed }: { seed: string }) {
  const n = 21;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const cells: boolean[] = [];
  for (let i = 0; i < n * n; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    cells.push(((h >>> 16) & 1) === 1);
  }
  const finder = (x: number, y: number) => x < 7 && y < 7;
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="size-full" shapeRendering="crispEdges">
      {cells.map((on, i) => {
        const x = i % n;
        const y = Math.floor(i / n);
        const inFinder = finder(x, y) || finder(n - 1 - x, y) || finder(x, n - 1 - y);
        let fill = on;
        if (inFinder) {
          const fx = x < 7 ? x : n - 1 - x;
          const fy = y < 7 ? y : n - 1 - y;
          const ring = fx === 0 || fy === 0 || fx === 6 || fy === 6;
          const core = fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4;
          fill = ring || core;
        }
        return fill ? <rect key={i} x={x} y={y} width={1} height={1} fill="#111" /> : null;
      })}
    </svg>
  );
}
