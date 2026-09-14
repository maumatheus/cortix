"use client";

import { useState } from "react";
import { Palette, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, useFetch } from "@/lib/hooks";
import { timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Page, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/progress";
import { BrandKitDialog, type BrandKit } from "@/components/brand-kit/brand-kit-dialog";

export default function BrandKitPage() {
  const { data, loading, reload } = useFetch<{ data: BrandKit[] }>("/api/v1/brand-kits");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BrandKit | null>(null);
  const kits = data?.data ?? [];

  async function remove(k: BrandKit) {
    if (!confirm(`Excluir o brand kit "${k.name}"?`)) return;
    try {
      await api(`/api/v1/brand-kits/${k.id}`, { method: "DELETE" });
      toast.success("Brand kit excluído");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Criar · Identidade"
        dot
        title="Brand Kit"
        description="Gerencie seus brand kits e personalize suas criações"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus /> Criar Brand Kit
          </Button>
        }
      />

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      ) : kits.length === 0 ? (
        <EmptyState
          icon={<Palette />}
          title="Nenhum brand kit criado ainda."
          description={'Clique em "Criar Brand Kit" para começar.'}
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus /> Criar Brand Kit
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kits.map((k) => (
            <div key={k.id} className="group overflow-hidden rounded-2xl border bg-card">
              <div className="relative h-32" style={{ background: `linear-gradient(135deg, ${k.primaryColor} 0%, ${k.secondaryColor} 100%)` }}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,.25),transparent_50%)]" />
                <div className="absolute bottom-3 left-4 flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center overflow-hidden rounded-xl border border-white/30 bg-black/40 backdrop-blur">
                    {k.logoUrl ? <img src={k.logoUrl} alt="" className="size-full object-contain p-1" /> : <span className="text-lg font-black text-white">{k.name.slice(0, 1).toUpperCase()}</span>}
                  </div>
                  <p className="text-sm font-black uppercase tracking-wide text-white drop-shadow" style={{ fontFamily: `"${k.font}", Montserrat, sans-serif` }}>
                    {k.handle || k.name}
                  </p>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{k.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{k.handle || "sem @"} · criado há {timeAgo(k.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-70 transition group-hover:opacity-100">
                    <button
                      className="rounded-lg border p-2 hover:bg-secondary"
                      title="Editar"
                      onClick={() => {
                        setEditing(k);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button className="rounded-lg border p-2 text-destructive hover:bg-destructive/10" title="Excluir" onClick={() => remove(k)}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Swatch color={k.primaryColor} label="Primária" />
                  <Swatch color={k.secondaryColor} label="Secundária" />
                  <div className="ml-auto text-right">
                    <p className="eyebrow !text-[9px]">Fonte</p>
                    <p className="text-xs font-semibold" style={{ fontFamily: `"${k.font}", Montserrat, sans-serif` }}>
                      {k.font}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <BrandKitDialog open={open} onOpenChange={setOpen} kit={editing} onSaved={reload} />
    </Page>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-6 rounded-md border border-white/10" style={{ background: color }} />
      <div>
        <p className="eyebrow !text-[9px]">{label}</p>
        <p className="font-mono text-[11px] uppercase">{color}</p>
      </div>
    </div>
  );
}
