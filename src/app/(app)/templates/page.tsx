"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, LayoutTemplate, Lock, Pencil, Plus, Sparkles, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { api, useFetch } from "@/lib/hooks";
import { getCaptionStyle, LAYOUTS } from "@/lib/caption-styles";
import { Button } from "@/components/ui/button";
import { Page, PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TemplateDialog, type TemplateItem } from "@/components/templates/template-dialog";
import { TemplatePreview } from "@/components/templates/template-preview";

export default function TemplatesPage() {
  const router = useRouter();
  const mine = useFetch<{ data: TemplateItem[] }>("/api/v1/templates?scope=mine");
  const pub = useFetch<{ data: TemplateItem[] }>("/api/v1/templates?scope=public");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateItem | null>(null);
  const [tab, setTab] = useState("mine");

  function reloadAll() {
    mine.reload();
    pub.reload();
  }

  async function use(t: TemplateItem) {
    try {
      const r = await api<{ apply: { captionStyleId: string; captionFont: string; layout: string } }>(`/api/v1/templates/${t.id}/use`, { method: "POST" });
      toast.success(`Template "${t.name}" aplicado. Crie seu projeto com ele.`);
      reloadAll();
      router.push(`/criar-projeto?style=${encodeURIComponent(r.apply.captionStyleId)}&layout=${encodeURIComponent(r.apply.layout)}&font=${encodeURIComponent(r.apply.captionFont)}&template=${t.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove(t: TemplateItem) {
    if (!confirm(`Excluir o template "${t.name}"?`)) return;
    try {
      await api(`/api/v1/templates/${t.id}`, { method: "DELETE" });
      toast.success("Template excluído");
      reloadAll();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function togglePublic(t: TemplateItem) {
    try {
      await api(`/api/v1/templates/${t.id}`, { method: "PATCH", json: { isPublic: !t.isPublic } });
      toast.success(t.isPublic ? "Template agora é privado" : "Template publicado na galeria");
      reloadAll();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Page wide>
      <PageHeader
        eyebrow="Criar · Layouts"
        dot
        title="Templates"
        description="Crie layouts reutilizáveis e explore os da comunidade."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus /> Criar template
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="mine">
            <Lock /> Meus templates {mine.data ? <span className="rounded bg-secondary px-1.5 text-[10px]">{mine.data.data.length}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="public">
            <Globe /> Galeria pública {pub.data ? <span className="rounded bg-secondary px-1.5 text-[10px]">{pub.data.data.length}</span> : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine">
          {mine.loading && !mine.data ? (
            <Grid>{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[9/14]" />)}</Grid>
          ) : (mine.data?.data.length ?? 0) === 0 ? (
            <EmptyState
              icon={<LayoutTemplate />}
              title="Você ainda não criou templates"
              description="Crie um template para reaproveitar seus layouts favoritos em qualquer projeto."
              action={
                <Button
                  onClick={() => {
                    setEditing(null);
                    setOpen(true);
                  }}
                >
                  <Plus /> Criar template
                </Button>
              }
            />
          ) : (
            <Grid>
              {mine.data!.data.map((t) => (
                <TemplateCard
                  key={t.id}
                  t={t}
                  onUse={() => use(t)}
                  onEdit={() => {
                    setEditing(t);
                    setOpen(true);
                  }}
                  onDelete={() => remove(t)}
                  onTogglePublic={() => togglePublic(t)}
                />
              ))}
            </Grid>
          )}
        </TabsContent>

        <TabsContent value="public">
          {pub.loading && !pub.data ? (
            <Grid>{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="aspect-[9/14]" />)}</Grid>
          ) : (pub.data?.data.length ?? 0) === 0 ? (
            <EmptyState icon={<Users />} title="A galeria ainda está vazia" description="Publique um dos seus templates pra aparecer aqui." />
          ) : (
            <Grid>
              {pub.data!.data.map((t) => (
                <TemplateCard key={t.id} t={t} onUse={() => use(t)} onEdit={t.isMine ? () => { setEditing(t); setOpen(true); } : undefined} onDelete={t.isMine ? () => remove(t) : undefined} onTogglePublic={t.isMine ? () => togglePublic(t) : undefined} />
              ))}
            </Grid>
          )}
        </TabsContent>
      </Tabs>

      <TemplateDialog open={open} onOpenChange={setOpen} template={editing} onSaved={reloadAll} />
    </Page>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{children}</div>;
}

function TemplateCard({ t, onUse, onEdit, onDelete, onTogglePublic }: { t: TemplateItem; onUse: () => void; onEdit?: () => void; onDelete?: () => void; onTogglePublic?: () => void }) {
  const style = getCaptionStyle(t.config.styleId);
  const layout = LAYOUTS.find((l) => l.id === t.config.layout);
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border bg-card">
      <div className="relative p-3 pb-0">
        <TemplatePreview styleId={t.config.styleId} layout={t.config.layout} font={t.config.font} />
        <div className="absolute left-5 top-5 flex gap-1">
          {t.isPublic ? (
            <Badge variant="success" className="!text-[9px]">
              <Globe className="size-2.5" /> Público
            </Badge>
          ) : (
            <Badge variant="mono" className="!text-[9px]">
              Privado
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="truncate text-sm font-semibold" title={t.name}>
          {t.name}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {style.name} · {layout?.name ?? t.config.layout} · {t.config.font}
        </p>
        {t.config.description ? <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{t.config.description}</p> : null}
        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{t.isMine ? "Seu template" : `por ${t.author ?? "comunidade"}`}</span>
          <span className="font-mono">{t.uses} usos</span>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <Button size="sm" className="flex-1" onClick={onUse}>
            <Sparkles /> Usar
          </Button>
          {onTogglePublic ? (
            <button className="rounded-md border p-1.5 hover:bg-secondary" title={t.isPublic ? "Tornar privado" : "Publicar na galeria"} onClick={onTogglePublic}>
              {t.isPublic ? <Lock className="size-3.5" /> : <Globe className="size-3.5" />}
            </button>
          ) : null}
          {onEdit ? (
            <button className="rounded-md border p-1.5 hover:bg-secondary" title="Editar" onClick={onEdit}>
              <Pencil className="size-3.5" />
            </button>
          ) : null}
          {onDelete ? (
            <button className="rounded-md border p-1.5 text-destructive hover:bg-destructive/10" title="Excluir" onClick={onDelete}>
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
