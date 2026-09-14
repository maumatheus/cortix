"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api, useFetch } from "@/lib/hooks";
import { buildBatchSlots, MAX_POSTS_PER_DAY, MIN_GAP_HOURS } from "@/lib/schedule-rules";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PLATFORMS, type PlatformId } from "@/components/shared/platform";
import { ShortPicker } from "@/components/shared/short-picker";
import type { SocialAccountItem } from "@/components/social/connect-account-dialog";

export interface ScheduledPostItem {
  id: string;
  shortId: string | null;
  socialAccountId: string | null;
  platform: PlatformId;
  caption: string;
  scheduledAt: string;
  status: "scheduled" | "published" | "failed" | "canceled";
  createdAt: string;
  short: { id: string; title: string; thumbnailUrl: string | null; renderUrl: string | null; status: string; projectId: string; project: { title: string } } | null;
  socialAccount: { id: string; platform: string; handle: string } | null;
}

/** "YYYY-MM-DDTHH:mm" no fuso local, pra <input type="datetime-local"> */
export function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function defaultStart() {
  const d = new Date(Date.now() + 3600_000);
  d.setMinutes(0, 0, 0);
  return toLocalInput(d);
}

function useAccounts(platform: string) {
  const { data } = useFetch<{ data: SocialAccountItem[] }>("/api/v1/social-accounts?purpose=publish");
  return useMemo(() => (data?.data ?? []).filter((a) => a.platform === platform), [data, platform]);
}

export function NewPostDialog({ open, onOpenChange, preselectShortId, post, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; preselectShortId?: string | null; post?: ScheduledPostItem | null; onSaved: () => void }) {
  const [shortIds, setShortIds] = useState<string[]>([]);
  const [platform, setPlatform] = useState<PlatformId>("youtube");
  const [accountId, setAccountId] = useState("");
  const [when, setWhen] = useState(defaultStart());
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const accounts = useAccounts(platform);

  useEffect(() => {
    if (!open) return;
    setShortIds(post?.shortId ? [post.shortId] : preselectShortId ? [preselectShortId] : []);
    setPlatform(post?.platform ?? "youtube");
    setAccountId(post?.socialAccountId ?? "");
    setWhen(post ? toLocalInput(new Date(post.scheduledAt)) : defaultStart());
    setCaption(post?.caption ?? "");
  }, [open, post, preselectShortId]);

  useEffect(() => {
    if (accountId && !accounts.some((a) => a.id === accountId)) setAccountId("");
  }, [accounts, accountId]);

  async function save() {
    if (!when) return toast.error("Escolha a data e hora");
    setLoading(true);
    try {
      const scheduledAt = new Date(when).toISOString();
      if (post) {
        await api(`/api/v1/schedule/${post.id}`, { method: "PATCH", json: { platform, socialAccountId: accountId || null, scheduledAt, caption } });
        toast.success("Post atualizado");
      } else {
        await api("/api/v1/schedule", { method: "POST", json: { shortId: shortIds[0] || null, platform, socialAccountId: accountId || null, scheduledAt, caption } });
        toast.success("Post agendado");
      }
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{post ? "Editar post" : "Novo post"}</DialogTitle>
          <DialogDescription>{post ? "Ajuste horário, rede, conta ou legenda." : "Escolha um corte, a rede e o melhor horário."}</DialogDescription>
        </DialogHeader>
        <div className="scrollbar-thin max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {post ? (
            <div className="flex items-center gap-3 rounded-xl border bg-secondary/40 p-3">
              <div className="h-14 w-8 shrink-0 overflow-hidden rounded-md bg-secondary">{post.short?.thumbnailUrl ? <img src={post.short.thumbnailUrl} alt="" className="size-full object-cover" /> : null}</div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{post.short?.title ?? "Sem corte vinculado"}</p>
                <p className="truncate text-xs text-muted-foreground">{post.short?.project.title}</p>
              </div>
            </div>
          ) : (
            <ShortPicker selected={shortIds} onChange={(ids) => setShortIds(ids)} preselectedId={preselectShortId} />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Rede</Label>
              <NativeSelect value={platform} onChange={(e) => setPlatform(e.target.value as PlatformId)} className="mt-1 w-full">
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Conta</Label>
              <NativeSelect value={accountId} onChange={(e) => setAccountId(e.target.value)} className="mt-1 w-full">
                <option value="">{accounts.length ? "Sem conta vinculada" : "Nenhuma conta conectada"}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.handle}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div>
            <Label>Data e hora</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-1" min={toLocalInput(new Date())} />
          </div>
          <div>
            <Label>Legenda</Label>
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Legenda, hashtags e menções…" className="mt-1 min-h-20" maxLength={2200} />
            <p className="mt-1 text-right font-mono text-[10px] text-muted-foreground">{caption.length}/2200</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} loading={loading}>
            {post ? "Salvar" : "Agendar post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BatchDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const [shortIds, setShortIds] = useState<string[]>([]);
  const [platform, setPlatform] = useState<PlatformId>("youtube");
  const [accountId, setAccountId] = useState("");
  const [startAt, setStartAt] = useState(defaultStart());
  const [intervalHours, setIntervalHours] = useState(4);
  const [maxPerDay, setMaxPerDay] = useState(MAX_POSTS_PER_DAY);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const accounts = useAccounts(platform);

  useEffect(() => {
    if (!open) return;
    setShortIds([]);
    setPlatform("youtube");
    setAccountId("");
    setStartAt(defaultStart());
    setIntervalHours(4);
    setMaxPerDay(MAX_POSTS_PER_DAY);
    setCaption("");
  }, [open]);

  const slots = useMemo(() => {
    const d = new Date(startAt);
    if (!shortIds.length || isNaN(d.getTime())) return [];
    return buildBatchSlots(shortIds.length, d, intervalHours, maxPerDay);
  }, [shortIds.length, startAt, intervalHours, maxPerDay]);

  async function save() {
    if (!shortIds.length) return toast.error("Selecione pelo menos um corte");
    setLoading(true);
    try {
      const r = await api<{ created: number }>("/api/v1/schedule/batch", {
        method: "POST",
        json: { shortIds, platform, socialAccountId: accountId || null, startAt: new Date(startAt).toISOString(), intervalHours, maxPerDay, caption },
      });
      toast.success(`${r.created} posts agendados`);
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Agendar em lote</DialogTitle>
          <DialogDescription>Selecione vários cortes e o Cortix distribui nos horários respeitando os limites da conta.</DialogDescription>
        </DialogHeader>
        <div className="scrollbar-thin max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <ShortPicker multiple selected={shortIds} onChange={(ids) => setShortIds(ids)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Rede</Label>
              <NativeSelect value={platform} onChange={(e) => setPlatform(e.target.value as PlatformId)} className="mt-1 w-full">
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Conta</Label>
              <NativeSelect value={accountId} onChange={(e) => setAccountId(e.target.value)} className="mt-1 w-full">
                <option value="">{accounts.length ? "Sem conta vinculada" : "Nenhuma conta conectada"}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.handle}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label>Começar em</Label>
              <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="mt-1" min={toLocalInput(new Date())} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Intervalo (h)</Label>
                <Input type="number" min={MIN_GAP_HOURS} max={24} value={intervalHours} onChange={(e) => setIntervalHours(Math.max(MIN_GAP_HOURS, Math.min(24, Number(e.target.value) || MIN_GAP_HOURS)))} className="mt-1" />
              </div>
              <div>
                <Label>Máx. por dia</Label>
                <Input type="number" min={1} max={MAX_POSTS_PER_DAY} value={maxPerDay} onChange={(e) => setMaxPerDay(Math.max(1, Math.min(MAX_POSTS_PER_DAY, Number(e.target.value) || 1)))} className="mt-1" />
              </div>
            </div>
          </div>
          <div>
            <Label>Legenda padrão (opcional)</Label>
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Se vazio, usa o título de cada corte." className="mt-1 min-h-16" maxLength={2200} />
          </div>
          {slots.length ? (
            <div className="rounded-xl border bg-secondary/30 p-3">
              <p className="eyebrow">Prévia dos horários</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {slots.map((s, i) => (
                  <span key={i} className="rounded-md border bg-background px-2 py-1 font-mono text-[11px]">
                    {s.toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} loading={loading} disabled={!shortIds.length}>
            Agendar {shortIds.length ? `${shortIds.length} posts` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
