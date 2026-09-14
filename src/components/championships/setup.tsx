"use client";

import { useEffect, useState } from "react";
import { Check, Link2, Trash2, TriangleAlert, Wallet } from "lucide-react";
import { toast } from "sonner";
import { api, useFetch, useUser } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { PLATFORMS, platformLabel } from "@/lib/championships";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/progress";
import type { ChampionshipAccount, Requirements } from "./types";

/** Aviso exibido enquanto faltar chave PIX ou conta social vinculada. */
export function RequirementsNotice({ requirements, onConfigure, className }: { requirements: Requirements; onConfigure: () => void; className?: string }) {
  if (requirements.pixKey && requirements.socialAccount) return null;
  return (
    <div className={cn("flex flex-col gap-4 rounded-2xl border border-warning/40 bg-warning/5 p-5 md:flex-row md:items-center", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-warning/60 text-warning">
        <TriangleAlert className="size-4" />
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold">Configuração necessária</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Para participar dos campeonatos, você precisa configurar:</p>
        <ul className="mt-2 space-y-1 text-xs">
          <RequirementItem done={requirements.pixKey} text="Chave PIX (necessária para receber prêmios)" />
          <RequirementItem done={requirements.socialAccount} text="Contas de redes sociais (necessárias para enviar vídeos)" />
        </ul>
      </div>
      <Button onClick={onConfigure} className="shrink-0">
        Configurar agora
      </Button>
    </div>
  );
}

function RequirementItem({ done, text }: { done: boolean; text: string }) {
  return (
    <li className={cn("flex items-center gap-2", done ? "text-muted-foreground line-through" : "text-foreground")}>
      {done ? <Check className="size-3.5 text-success" /> : <span className="inline-block w-3.5 text-center">•</span>}
      {text}
    </li>
  );
}

/** Diálogo de contas sociais usadas nos campeonatos (purpose = "championship"). */
export function AccountsDialog({ open, onOpenChange, onChanged }: { open: boolean; onOpenChange: (o: boolean) => void; onChanged?: () => void }) {
  const { data, loading, reload } = useFetch<{ data: ChampionshipAccount[] }>(open ? "/api/v1/championship-accounts?purpose=championship" : null);
  const [platform, setPlatform] = useState<string>("tiktok");
  const [handle, setHandle] = useState("");
  const [saving, setSaving] = useState(false);
  const accounts = data?.data || [];

  async function add() {
    if (handle.trim().replace(/^@+/, "").length < 2) return toast.error("Informe o @ da conta");
    setSaving(true);
    try {
      await api("/api/v1/championship-accounts", { method: "POST", json: { platform, handle: handle.trim(), purpose: "championship" } });
      toast.success("Conta conectada");
      setHandle("");
      await reload();
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(a: ChampionshipAccount) {
    if (!confirm(`Desconectar @${a.handle} (${platformLabel(a.platform)})?`)) return;
    try {
      await api(`/api/v1/championship-accounts/${a.id}`, { method: "DELETE" });
      toast.success("Conta removida");
      await reload();
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <p className="eyebrow !text-primary">Campeonatos · Contas</p>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-4" /> Contas conectadas
          </DialogTitle>
          <DialogDescription>Cadastre as contas onde você vai publicar os cortes. Só vídeos dessas contas contam nos campeonatos.</DialogDescription>
        </DialogHeader>

        {loading && !data ? (
          <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
            <Spinner /> Carregando…
          </div>
        ) : accounts.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-5 text-center text-xs text-muted-foreground">Nenhuma conta conectada ainda.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {accounts.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{platformLabel(a.platform)}</span>
                <span className="flex-1 truncate text-sm font-medium">@{a.handle}</span>
                <button onClick={() => remove(a)} className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive cursor-pointer" title="Remover">
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 grid gap-3 rounded-xl border bg-secondary/30 p-4 sm:grid-cols-[140px_1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="acc-platform">Plataforma</Label>
            <NativeSelect id="acc-platform" value={platform} onChange={(e) => setPlatform(e.target.value)} className="mt-1 w-full">
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="acc-handle">@ da conta</Label>
            <Input id="acc-handle" value={handle} onChange={(e) => setHandle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="@seuperfil" className="mt-1" />
          </div>
          <Button onClick={add} loading={saving}>
            Adicionar
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Diálogo para salvar a chave PIX do usuário (PATCH /api/v1/user). */
export function PixDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved?: () => void }) {
  const { user, refresh } = useUser();
  const [pixKey, setPixKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setPixKey(user?.pixKey || "");
  }, [open, user?.pixKey]);

  async function save() {
    const key = pixKey.trim();
    if (key.length < 5) return toast.error("Informe uma chave PIX válida");
    setSaving(true);
    try {
      await api("/api/v1/user", { method: "PATCH", json: { pixKey: key } });
      await refresh();
      toast.success("Chave PIX salva");
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <p className="eyebrow !text-primary">Campeonatos · Pagamentos</p>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="size-4" /> Chave PIX
          </DialogTitle>
          <DialogDescription>É nesta chave que os organizadores pagam os prêmios. Pode ser CPF/CNPJ, e-mail, telefone ou chave aleatória.</DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="pix-key">Chave PIX</Label>
          <Input id="pix-key" value={pixKey} onChange={(e) => setPixKey(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} placeholder="email@exemplo.com, CPF ou chave aleatória" maxLength={120} className="mt-1" />
          {user?.pixKey ? <p className="mt-2 text-[11px] text-muted-foreground">Chave atual: <span className="font-mono text-foreground">{user.pixKey}</span></p> : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            Salvar chave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
