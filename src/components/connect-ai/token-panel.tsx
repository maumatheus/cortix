"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, useFetch } from "@/lib/hooks";
import { timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/progress";

interface TokenRow {
  id: string;
  name: string;
  masked: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export function TokenPanel() {
  const { data, loading, reload } = useFetch<{ data: TokenRow[] }>("/api/v1/tokens");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<{ id: string; token: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const tokens = data?.data ?? [];

  async function create() {
    setCreating(true);
    try {
      const r = await api<{ token: { id: string; token: string; name: string } }>("/api/v1/tokens", { method: "POST", json: { name: name.trim() || "Meu assistente" } });
      setFresh(r.token);
      setName("");
      setCopied(false);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function revoke(t: TokenRow) {
    if (!confirm(`Revogar o token "${t.name}"? Os apps que usam ele param de funcionar.`)) return;
    try {
      await api(`/api/v1/tokens/${t.id}`, { method: "DELETE" });
      if (fresh?.id === t.id) setFresh(null);
      toast.success("Token revogado");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function copy() {
    if (!fresh) return;
    navigator.clipboard.writeText(fresh.token).then(() => {
      setCopied(true);
      toast.success("Token copiado");
    });
  }

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <KeyRound className="size-4" />
        </span>
        <div>
          <p className="font-semibold">Token de acesso</p>
          <p className="text-xs text-muted-foreground">Identifica você quando a IA fala com o Cortix.</p>
        </div>
      </div>

      {fresh ? (
        <div className="mt-4 rounded-xl border border-success/40 bg-success/5 p-3">
          <p className="text-xs font-semibold text-success">Token &ldquo;{fresh.name}&rdquo; criado. Copie agora — ele não será mostrado de novo.</p>
          <div className="mt-2 flex gap-2">
            <code className="scrollbar-thin flex-1 overflow-x-auto whitespace-nowrap rounded-md bg-background px-2 py-2 font-mono text-[11px]">{fresh.token}</code>
            <Button size="sm" variant={copied ? "secondary" : "default"} onClick={copy}>
              {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <Label>Novo token</Label>
        <div className="mt-1 flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (ex: Claude no notebook)" onKeyDown={(e) => e.key === "Enter" && create()} />
          <Button onClick={create} loading={creating}>
            <Plus /> Gerar
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <p className="eyebrow">Seus tokens</p>
        {loading && !data ? (
          <Skeleton className="mt-2 h-12" />
        ) : tokens.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">Nenhum token ainda. Gere um pra conectar seu assistente.</p>
        ) : (
          <div className="mt-2 divide-y rounded-xl border">
            {tokens.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {t.masked} · {t.lastUsedAt ? `usado há ${timeAgo(t.lastUsedAt)}` : "nunca usado"}
                  </p>
                </div>
                <button className="rounded-md border p-1.5 text-destructive hover:bg-destructive/10" title="Revogar" onClick={() => revoke(t)}>
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
