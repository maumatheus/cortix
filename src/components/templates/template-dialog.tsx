"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/hooks";
import { CAPTION_FONTS, CAPTION_STYLES, LAYOUTS } from "@/lib/caption-styles";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TemplatePreview } from "./template-preview";

export interface TemplateItem {
  id: string;
  name: string;
  config: { styleId: string; layout: string; font: string; description?: string };
  isPublic: boolean;
  uses: number;
  createdAt: string;
  isMine: boolean;
  author: string | null;
}

export function TemplateDialog({ open, onOpenChange, template, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; template?: TemplateItem | null; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [styleId, setStyleId] = useState("green-fresh");
  const [layout, setLayout] = useState("single");
  const [font, setFont] = useState("Montserrat");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? "");
    setStyleId(template?.config.styleId ?? "green-fresh");
    setLayout(template?.config.layout ?? "single");
    setFont(template?.config.font ?? "Montserrat");
    setDescription(template?.config.description ?? "");
    setIsPublic(template?.isPublic ?? false);
  }, [open, template]);

  async function save() {
    if (!name.trim()) return toast.error("Dê um nome ao template");
    setLoading(true);
    try {
      const payload = { name: name.trim(), config: { styleId, layout, font, description: description.trim() || undefined }, isPublic };
      if (template) await api(`/api/v1/templates/${template.id}`, { method: "PATCH", json: payload });
      else await api("/api/v1/templates", { method: "POST", json: payload });
      toast.success(template ? "Template atualizado" : "Template criado");
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
          <DialogTitle>{template ? "Editar template" : "Criar template"}</DialogTitle>
          <DialogDescription>Combine estilo de legenda, layout e fonte pra reaproveitar em qualquer projeto.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 sm:grid-cols-[1fr_170px]">
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Podcast com destaque verde" className="mt-1" autoFocus />
            </div>
            <div>
              <Label>Estilo de legenda</Label>
              <NativeSelect value={styleId} onChange={(e) => setStyleId(e.target.value)} className="mt-1 w-full">
                {CAPTION_STYLES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Layout</Label>
                <NativeSelect value={layout} onChange={(e) => setLayout(e.target.value)} className="mt-1 w-full">
                  {LAYOUTS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} — {l.description}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <Label>Fonte</Label>
                <NativeSelect value={font} onChange={(e) => setFont(e.target.value)} className="mt-1 w-full">
                  {CAPTION_FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Pra que serve esse template?" className="mt-1 min-h-16" maxLength={200} />
            </div>
            <label className="flex items-center justify-between rounded-xl border px-4 py-3">
              <span>
                <span className="block text-sm font-semibold">Publicar na galeria</span>
                <span className="block text-xs text-muted-foreground">Outros criadores podem usar este template.</span>
              </span>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </label>
          </div>
          <div>
            <Label>Prévia</Label>
            <TemplatePreview styleId={styleId} layout={layout} font={font} className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} loading={loading}>
            {template ? "Salvar" : "Criar template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
