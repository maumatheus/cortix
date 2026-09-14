"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/hooks";
import { CAPTION_FONTS } from "@/lib/caption-styles";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface BrandKit {
  id: string;
  name: string;
  handle: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  font: string;
  createdAt: string;
}

export function BrandKitDialog({ open, onOpenChange, kit, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; kit?: BrandKit | null; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [primary, setPrimary] = useState("#7c3aed");
  const [secondary, setSecondary] = useState("#76FF03");
  const [font, setFont] = useState("Montserrat");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(kit?.name ?? "");
    setHandle(kit?.handle ?? "");
    setPrimary(kit?.primaryColor ?? "#7c3aed");
    setSecondary(kit?.secondaryColor ?? "#76FF03");
    setFont(kit?.font ?? "Montserrat");
    setFile(null);
    setPreview(kit?.logoUrl ?? null);
  }, [open, kit]);

  function pick(f: File | null) {
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview(kit?.logoUrl ?? null);
  }

  async function save() {
    if (!name.trim()) return toast.error("Dê um nome ao brand kit");
    setLoading(true);
    try {
      const payload = { name: name.trim(), handle: handle.trim() || null, primaryColor: primary, secondaryColor: secondary, font };
      let id = kit?.id;
      if (kit) await api(`/api/v1/brand-kits/${kit.id}`, { method: "PATCH", json: payload });
      else {
        const r = await api<{ kit: BrandKit }>("/api/v1/brand-kits", { method: "POST", json: payload });
        id = r.kit.id;
      }
      if (file && id) {
        const fd = new FormData();
        fd.append("file", file);
        await api(`/api/v1/brand-kits/${id}/logo`, { method: "POST", body: fd });
      }
      toast.success(kit ? "Brand kit atualizado" : "Brand kit criado");
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
          <DialogTitle>{kit ? "Editar Brand Kit" : "Criar Brand Kit"}</DialogTitle>
          <DialogDescription>Cores, fonte, @ e logo que a IA aplica nos seus cortes.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Canal principal" className="mt-1" autoFocus />
            </div>
            <div>
              <Label>@handle</Label>
              <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@seucanal" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cor primária</Label>
                <div className="mt-1 flex items-center gap-2">
                  <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="size-10 cursor-pointer rounded-lg border bg-transparent p-1" />
                  <Input value={primary} onChange={(e) => setPrimary(e.target.value)} className="font-mono text-xs uppercase" />
                </div>
              </div>
              <div>
                <Label>Cor secundária</Label>
                <div className="mt-1 flex items-center gap-2">
                  <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="size-10 cursor-pointer rounded-lg border bg-transparent p-1" />
                  <Input value={secondary} onChange={(e) => setSecondary(e.target.value)} className="font-mono text-xs uppercase" />
                </div>
              </div>
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
            <Label>Logo</Label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileRef.current?.click()} className="mt-1 flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed bg-secondary/40 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground">
              {preview ? <img src={preview} alt="" className="size-full object-contain p-3" /> : (
                <>
                  <ImagePlus className="size-6" />
                  Enviar logo
                  <span className="text-[10px]">PNG, JPG, SVG · até 5MB</span>
                </>
              )}
            </button>
            {file ? (
              <button type="button" onClick={() => pick(null)} className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <X className="size-3" /> Remover
              </button>
            ) : null}
            <div className="mt-3 overflow-hidden rounded-xl border" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>
              <p className="px-3 py-4 text-center text-sm font-black uppercase text-white drop-shadow" style={{ fontFamily: `"${font}", Montserrat, sans-serif` }}>
                {handle || "@seucanal"}
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} loading={loading}>
            {kit ? "Salvar" : "Criar Brand Kit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
