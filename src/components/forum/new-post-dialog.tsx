"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/hooks";
import { CATEGORY_LABELS, FORUM_CATEGORIES, isForumCategory } from "@/lib/forum";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ForumPost } from "./types";

export function NewPostDialog({
  open,
  onOpenChange,
  defaultCategory,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: string;
  onCreated: (post: ForumPost) => void;
}) {
  const [category, setCategory] = useState<string>("geral");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setCategory(defaultCategory && isForumCategory(defaultCategory) ? defaultCategory : "geral");
  }, [open, defaultCategory]);

  async function submit() {
    if (content.trim().length < 3) return toast.error("Escreva pelo menos 3 caracteres");
    setSaving(true);
    try {
      const res = await api<{ post: ForumPost }>("/api/v1/forum/posts", {
        method: "POST",
        json: { category, title: title.trim() || undefined, content: content.trim() },
      });
      toast.success("Publicação criada");
      setTitle("");
      setContent("");
      onCreated(res.post);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <p className="eyebrow !text-primary">Fórum · Nova publicação</p>
          <DialogTitle>O que você quer compartilhar?</DialogTitle>
          <DialogDescription>Dúvidas, dicas, ideias ou resultados. Sem título, usamos a primeira linha do texto.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label htmlFor="np-category">Categoria</Label>
            <NativeSelect id="np-category" value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full">
              {FORUM_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <Label htmlFor="np-title">Título (opcional)</Label>
            <Input id="np-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Como saí do shadowban em 3 dias" maxLength={160} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="np-content">Conteúdo</Label>
            <Textarea id="np-content" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Conte o contexto, o que você tentou e o que funcionou…" className="mt-1 min-h-40" maxLength={5000} />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">{content.length}/5000</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={saving}>
            Publicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
