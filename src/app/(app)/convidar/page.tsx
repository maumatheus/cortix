"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy, Gift, Link2, MessageCircle, Pencil, Share2, ShoppingBag, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { api, useFetch, useUser } from "@/lib/hooks";
import { cn, timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Page } from "@/components/page-header";

interface ReferralsResp {
  code: string;
  link: string;
  sharePct: number;
  stats: { invited: number; pending: number; purchased: number; creditsEarned: number };
  referrals: { id: string; name: string; status: "pending" | "purchased"; creditsAwarded: number; createdAt: string }[];
}

export default function ConvidarPage() {
  const { refresh } = useUser();
  const { data, reload } = useFetch<ReferralsResp>("/api/v1/referrals");
  const [copied, setCopied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const link = data?.link ?? "";
  const waText = `Cria seus cortes virais com IA no Cortix. Usa meu link e a gente ganha créditos juntos: ${link}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(waText)}`;

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  return (
    <Page>
      <div className="max-w-3xl">
        <p className="eyebrow flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-success" /> Ganhar · Indicações
        </p>
        <h1 className="display mt-3 text-4xl md:text-5xl">Convide um amigo</h1>
        <p className="mt-4 text-muted-foreground">Vocês dois ganham: 50% dos créditos do plano, para cada lado, quando seu amigo fizer a primeira compra.</p>
      </div>

      <div className="mt-6 flex gap-3 rounded-2xl border border-warning/40 bg-warning/5 px-5 py-4">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
        <div>
          <p className="text-sm font-semibold">Participa do programa de afiliados? Use o mesmo código</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Seu código de convite é o mesmo do programa de afiliados. Ao personalizar aqui, ele muda também nos seus links de afiliado, e os links antigos deixam de funcionar. Escolha um código fácil de lembrar e use sempre o mesmo.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border bg-card p-6">
          <p className="eyebrow">Seu link de convite</p>
          <div className="mt-3 flex items-center gap-2">
            <Link2 className="size-4 shrink-0 text-muted-foreground" />
            {data ? <Input readOnly value={link} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} /> : <Skeleton className="h-10 w-full" />}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={copy} disabled={!data}>
              {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar link"}
            </Button>
            <Button asChild variant="secondary">
              <a href={waHref} target="_blank" rel="noreferrer" aria-disabled={!data}>
                <MessageCircle /> Enviar no WhatsApp
              </a>
            </Button>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
            <span className="text-sm text-muted-foreground">
              Seu código: <span className="rounded bg-primary/15 px-2 py-0.5 font-mono text-sm font-bold text-primary">{data?.code ?? "…"}</span>
            </span>
            <button onClick={() => setEditOpen(true)} className="flex items-center gap-1 text-sm text-primary hover:underline">
              <Pencil className="size-3.5" /> Personalizar
            </button>
          </div>
          <ul className="mt-5 space-y-2 text-xs text-muted-foreground">
            <li className="flex gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-success" />A recompensa é liberada apenas na primeira compra do seu amigo (plano ou pacote de créditos).
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-success" />O crédito é proporcional ao que ele comprar: {data?.sharePct ?? 50}% dos créditos do plano ou pacote, para cada um de vocês.
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-success" />Seu amigo precisa criar a conta pelo seu link (ou informar seu código no cadastro).
            </li>
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Tile icon={<Users />} label="Convidados" value={data?.stats.invited} />
          <Tile icon={<UserPlus />} label="Pendentes" sub="Ainda não compraram" value={data?.stats.pending} />
          <Tile icon={<ShoppingBag />} label="Compraram" value={data?.stats.purchased} accent="success" />
          <Tile icon={<Gift />} label="Créditos ganhos" value={data?.stats.creditsEarned} accent="primary" />
        </div>
      </div>

      <div className="mt-10">
        <p className="eyebrow">Como funciona</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Step n="01" icon={<Share2 />} title="Compartilhe seu link" desc="Envie para amigos, seguidores ou para a sua comunidade de clipadores." />
          <Step n="02" icon={<UserPlus />} title="Seu amigo cria a conta" desc="Ele se cadastra pelo seu link e aparece aqui como indicação pendente." />
          <Step n="03" icon={<Gift />} title="Vocês dois ganham" desc="Na primeira compra dele, cada um recebe 50% dos créditos do plano ou pacote." />
        </div>
      </div>

      <div className="mt-10">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Suas indicações</h2>
          <span className="eyebrow">{data?.stats.invited ?? 0} pessoas</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        {!data ? (
          <Skeleton className="mt-4 h-32 w-full" />
        ) : data.referrals.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card/40 px-6 py-14 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Users className="size-7" />
            </span>
            <p className="text-base font-semibold">Você ainda não convidou ninguém</p>
            <p className="max-w-md text-sm text-muted-foreground">Compartilhe seu link e acompanhe aqui quem se cadastrou e quem já fez a primeira compra.</p>
            <Button asChild className="mt-2">
              <a href={waHref} target="_blank" rel="noreferrer">
                <MessageCircle /> Convidar pelo WhatsApp
              </a>
            </Button>
          </div>
        ) : (
          <div className="mt-4 divide-y rounded-2xl border bg-card">
            {data.referrals.map((r) => (
              <div key={r.id} className="flex items-center gap-4 p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary">{r.name[0]}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-semibold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">Cadastro há {timeAgo(r.createdAt)}</p>
                </div>
                {r.status === "purchased" ? <span className="font-mono text-sm font-bold text-success">+{r.creditsAwarded}</span> : null}
                <Badge variant={r.status === "purchased" ? "success" : "warning"}>{r.status === "purchased" ? "Comprou" : "Pendente"}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <EditCodeDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        current={data?.code ?? ""}
        onSaved={async () => {
          await Promise.all([reload(), refresh()]);
        }}
      />
    </Page>
  );
}

function Tile({ icon, label, sub, value, accent }: { icon: React.ReactNode; label: string; sub?: string; value?: number; accent?: "success" | "primary" }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <span className={cn("flex size-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground [&_svg]:size-4", accent === "success" && "bg-success/15 text-success", accent === "primary" && "bg-primary/15 text-primary")}>{icon}</span>
      <p className={cn("mt-3 font-mono text-2xl font-bold", accent === "success" && "text-success", accent === "primary" && "text-primary")}>{value ?? "…"}</p>
      <p className="text-sm font-medium">{label}</p>
      {sub ? <p className="text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function Step({ n, icon, title, desc }: { n: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary [&_svg]:size-4">{icon}</span>
        <span className="font-mono text-xs text-muted-foreground">{n}</span>
      </div>
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function EditCodeDialog({ open, onOpenChange, current, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; current: string; onSaved: () => Promise<void> }) {
  const [code, setCode] = useState(current);
  const [saving, setSaving] = useState(false);
  const valid = /^[A-Z0-9]{4,12}$/i.test(code);

  async function save() {
    setSaving(true);
    try {
      await api("/api/v1/user", { method: "PATCH", json: { referralCode: code.toUpperCase() } });
      toast.success("Código atualizado");
      await onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) setCode(current);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Personalizar código</DialogTitle>
          <DialogDescription>De 4 a 12 letras ou números. Os links antigos deixam de funcionar.</DialogDescription>
        </DialogHeader>
        <Label>Novo código</Label>
        <Input autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="MEUCODIGO" className="mt-1 font-mono uppercase" maxLength={12} />
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving} disabled={!valid || code === current}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
