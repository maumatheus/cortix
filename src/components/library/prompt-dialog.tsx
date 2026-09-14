"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface LibraryPromptItem {
  id: string;
  title: string;
  content: string;
  isPublic: boolean;
  createdAt: string;
  isMine: boolean;
  author: string;
}

export function PromptDialog({ open, onOpenChange, prompt, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; prompt?: LibraryPromptItem | null; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(prompt?.title ?? "");
    setContent(prompt?.content ?? "");
    setIsPublic(prompt?.isPublic ?? false);
  }, [open, prompt]);

  async function save() {
    if (!title.trim() || !content.trim()) return toast.error("Preencha título e conteúdo");
    setLoading(true);
    try {
      const payload = { title: title.trim(), content: content.trim(), isPublic };
      if (prompt) await api(`/api/v1/library/prompts/${prompt.id}`, { method: "PATCH", json: payload });
      else await api("/api/v1/library/prompts", { method: "POST", json: payload });
      toast.success(prompt ? "Prompt atualizado" : "Prompt salvo");
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{prompt ? "Editar prompt" : "Novo prompt"}</DialogTitle>
          <DialogDescription>Salve instruções pra IA e reaproveite em projetos e monitoramentos.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Momentos engraçados do podcast" className="mt-1" autoFocus />
          </div>
          <div>
            <Label>Prompt</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Descreva o que a IA deve procurar nos vídeos…" className="mt-1 min-h-36" maxLength={8000} />
            <p className="mt-1 text-right font-mono text-[10px] text-muted-foreground">{content.length}/8000</p>
          </div>
          <label className="flex items-center justify-between rounded-xl border px-4 py-3">
            <span>
              <span className="block text-sm font-semibold">Compartilhar publicamente</span>
              <span className="block text-xs text-muted-foreground">Aparece em &ldquo;Prompts públicos&rdquo; pra toda a comunidade.</span>
            </span>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} loading={loading}>
            {prompt ? "Salvar" : "Salvar prompt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
