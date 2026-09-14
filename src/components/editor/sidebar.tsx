"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, ChevronRight, File, FolderOpen, LayoutTemplate, Lock, Music, PanelRightOpen, Palette, Play, Plus, Search, Shapes, Sparkles, Type, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api } from "@/lib/hooks";
import { CAPTION_FONTS, CAPTION_STYLES } from "@/lib/caption-styles";
import { StyleTile } from "@/components/caption-preview";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tip } from "./menu";
import { ANIMATIONS, ELEMENT_EMOJIS, FILTER_CATEGORIES, MUSIC_TRACKS, OVERLAYS, SHAPES, SHAPE_COLORS, SOUND_EFFECTS, TRANSITIONS, VIDEO_FILTERS, VOICES } from "./constants";
import type { EditorStyle, PanelId, ShapeOverlay, UploadedFile } from "./types";

export interface SidebarProps {
  panel: PanelId | null;
  onPanel: (p: PanelId | null) => void;
  style: EditorStyle;
  onStyle: (patch: Partial<EditorStyle>) => void;
  onPreset: (id: string) => void;
  applyAll: boolean;
  onApplyAll: (v: boolean) => void;
  files: UploadedFile[];
  onUploadClick: () => void;
  onAddShape: (s: Omit<ShapeOverlay, "id" | "x" | "y" | "w" | "h">) => void;
  activeOverlays: string[];
  onToggleOverlay: (id: string) => void;
  isSubscriber: boolean;
  shortId: string;
  hook: string | null;
  onHook: (h: string | null) => void;
}

const RAIL: Array<{ id: PanelId; label: string; icon: React.ElementType }> = [
  { id: "templates", label: "Templates", icon: LayoutTemplate },
  { id: "texto", label: "Texto", icon: Type },
  { id: "brand", label: "Brand Kit", icon: Palette },
  { id: "arquivos", label: "Arquivos", icon: FolderOpen },
  { id: "audio", label: "Áudio", icon: Music },
  { id: "elementos", label: "Elementos", icon: Shapes },
  { id: "efeitos", label: "Efeitos", icon: Wand2 },
  { id: "ia", label: "IA", icon: Bot },
];

export function Sidebar(p: SidebarProps) {
  return (
    <div className="flex h-full shrink-0">
      {p.panel ? (
        <div className="flex w-80 flex-col border-l bg-[#0f0f11]">
          <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
            <span className="text-sm font-semibold">{RAIL.find((r) => r.id === p.panel)?.label}</span>
            <button type="button" onClick={() => p.onPanel(null)} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Fechar painel">
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
            {p.panel === "templates" ? <TemplatesPanel {...p} /> : null}
            {p.panel === "texto" ? <TextPanel {...p} /> : null}
            {p.panel === "brand" ? <BrandPanel {...p} /> : null}
            {p.panel === "arquivos" ? <FilesPanel {...p} /> : null}
            {p.panel === "audio" ? <AudioPanel /> : null}
            {p.panel === "elementos" ? <ElementsPanel {...p} /> : null}
            {p.panel === "efeitos" ? <EffectsPanel {...p} /> : null}
            {p.panel === "ia" ? <AiPanel {...p} /> : null}
          </div>
        </div>
      ) : null}
      <div className="flex w-16 shrink-0 flex-col items-center gap-1 border-l bg-[#0b0b0d] py-2">
        {RAIL.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => p.onPanel(p.panel === r.id ? null : r.id)}
            className={cn("flex w-14 flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground cursor-pointer", p.panel === r.id && "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary")}
          >
            <r.icon className="size-4" />
            {r.label}
          </button>
        ))}
        <div className="flex-1" />
        <Tip label="Abrir inspetor" side="left">
          <button type="button" onClick={() => p.onPanel("texto")} className="flex w-14 flex-col items-center gap-1 rounded-lg py-2 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer">
            <PanelRightOpen className="size-4" />
            Inspetor
          </button>
        </Tip>
      </div>
    </div>
  );
}

/* ---------- Templates ---------- */

interface TemplateItem {
  id: string;
  name: string;
  config: string | Record<string, unknown>;
  uses?: number;
}

function TemplatesPanel(p: SidebarProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Layouts prontos para o seu corte</p>
        <p className="text-xs text-muted-foreground">Escolha um estilo de legenda. Você pode ajustar tudo no painel Texto.</p>
      </div>
      <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
        Aplicar em todas as cenas
        <Switch checked={p.applyAll} onCheckedChange={p.onApplyAll} />
      </label>
      <Tabs defaultValue="prontos">
        <TabsList className="h-9 w-full">
          <TabsTrigger value="prontos" className="text-xs">
            Prontos
          </TabsTrigger>
          <TabsTrigger value="meus" className="text-xs">
            Meus
          </TabsTrigger>
          <TabsTrigger value="publicos" className="text-xs">
            Públicos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="prontos" className="mt-3">
          <StyleGrid style={p.style} onPreset={p.onPreset} />
        </TabsContent>
        <TabsContent value="meus" className="mt-3">
          <RemoteTemplates scope="mine" onApply={(cfg) => p.onStyle(cfg)} />
        </TabsContent>
        <TabsContent value="publicos" className="mt-3">
          <RemoteTemplates scope="public" onApply={(cfg) => p.onStyle(cfg)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StyleGrid({ style, onPreset }: { style: EditorStyle; onPreset: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {CAPTION_STYLES.map((s) => (
        <StyleTile key={s.id} style={s} selected={style.id === s.id} onClick={() => onPreset(s.id)} />
      ))}
    </div>
  );
}

function RemoteTemplates({ scope, onApply }: { scope: "mine" | "public"; onApply: (cfg: Partial<EditorStyle>) => void }) {
  const [items, setItems] = useState<TemplateItem[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    api<{ data?: TemplateItem[]; templates?: TemplateItem[] } | TemplateItem[]>(`/api/v1/templates?scope=${scope}`)
      .then((d) => {
        if (!alive) return;
        const list = Array.isArray(d) ? d : d.data || d.templates || [];
        setItems(list);
      })
      .catch(() => {
        if (!alive) return;
        setError(true);
        setItems([]);
      });
    return () => {
      alive = false;
    };
  }, [scope]);
  if (items === null) return <p className="py-6 text-center text-xs text-muted-foreground">Carregando…</p>;
  if (!items.length)
    return (
      <div className="rounded-xl border border-dashed px-4 py-8 text-center">
        <LayoutTemplate className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">{scope === "mine" ? "Você ainda não salvou templates" : "Nenhum template público"}</p>
        <p className="mt-1 text-xs text-muted-foreground">{error ? "Não foi possível carregar os templates agora." : "Salve estilos na página Templates para reutilizar aqui."}</p>
        <Button asChild size="sm" variant="secondary" className="mt-3">
          <Link href="/templates">Ir para Templates</Link>
        </Button>
      </div>
    );
  return (
    <div className="space-y-2">
      {items.map((t) => {
        let cfg: Record<string, unknown> = {};
        try {
          cfg = typeof t.config === "string" ? JSON.parse(t.config) : t.config;
        } catch {}
        return (
          <button key={t.id} type="button" onClick={() => onApply(cfg as Partial<EditorStyle>)} className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm hover:border-primary/60 hover:bg-secondary/60">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
              <LayoutTemplate className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{t.name}</span>
              <span className="block text-[11px] text-muted-foreground">{String((cfg as { fontFamily?: string }).fontFamily || "Montserrat")}{t.uses ? ` · ${t.uses} usos` : ""}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Texto (inspetor de legendas) ---------- */

function TextPanel(p: SidebarProps) {
  const s = p.style;
  const set = p.onStyle;
  return (
    <div className="space-y-5">
      <section>
        <div className="mb-2 flex items-center justify-between">
          <Label>Estilo</Label>
          <button type="button" onClick={() => p.onPreset("none")} className={cn("text-[11px] font-medium hover:underline", s.id === "none" ? "text-primary" : "text-muted-foreground")}>
            Sem legenda
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {CAPTION_STYLES.filter((x) => x.id !== "none").map((x) => (
            <StyleTile key={x.id} style={x} selected={s.id === x.id} onClick={() => p.onPreset(x.id)} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <Field label="Fonte">
          <NativeSelect value={s.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })} className="h-9 w-full">
            {CAPTION_FONTS.map((f) => (
              <option key={f} value={f} style={{ fontFamily: f }}>
                {f}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={`Tamanho · ${s.fontSize}px`}>
          <input type="range" min={36} max={140} value={s.fontSize} onChange={(e) => set({ fontSize: Number(e.target.value) })} className="w-full accent-[var(--primary)]" />
        </Field>
        <Field label="Peso">
          <NativeSelect value={s.fontWeight} onChange={(e) => set({ fontWeight: Number(e.target.value) })} className="h-9 w-full">
            {[400, 700, 900].map((w) => (
              <option key={w} value={w}>
                {w === 400 ? "Regular" : w === 700 ? "Bold" : "Black"}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <ColorField label="Texto" value={s.fillColor} onChange={(v) => set({ fillColor: v })} />
          <ColorField label="Destaque" value={s.highlightColor} onChange={(v) => set({ highlightColor: v })} />
          <ColorField label="Contorno" value={s.strokeColor} onChange={(v) => set({ strokeColor: v })} />
        </div>
        <Field label={`Contorno · ${s.strokeWidth}`}>
          <input type="range" min={0} max={20} value={s.strokeWidth} onChange={(e) => set({ strokeWidth: Number(e.target.value) })} className="w-full accent-[var(--primary)]" />
        </Field>
        <Row label="Maiúsculas">
          <Switch checked={s.textCase === "uppercase"} onCheckedChange={(v) => set({ textCase: v ? "uppercase" : "none" })} />
        </Row>
        <Row label="Sombra">
          <Switch checked={s.shadow} onCheckedChange={(v) => set({ shadow: v })} />
        </Row>
        <Row label="Itálico">
          <Switch checked={!!s.italic} onCheckedChange={(v) => set({ italic: v })} />
        </Row>
        <Field label="Posição">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-secondary/70 p-1">
            {(["top", "center", "bottom"] as const).map((pos) => (
              <button key={pos} type="button" onClick={() => set({ position: pos })} className={cn("rounded-md py-1.5 text-xs font-medium", s.position === pos ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
                {pos === "top" ? "Topo" : pos === "center" ? "Centro" : "Base"}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Modo de destaque">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-secondary/70 p-1">
            {(["word", "box", "none"] as const).map((m) => (
              <button key={m} type="button" onClick={() => set({ highlightMode: m })} className={cn("rounded-md py-1.5 text-xs font-medium", s.highlightMode === m ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground")}>
                {m === "word" ? "Palavra" : m === "box" ? "Caixa" : "Nenhum"}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Palavras por bloco">
            <Input type="number" min={1} max={12} value={s.wordsPerGroup} onChange={(e) => set({ wordsPerGroup: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })} className="h-9" />
          </Field>
          <Field label="Máx. caracteres">
            <Input type="number" min={6} max={80} value={s.maxChars} onChange={(e) => set({ maxChars: Math.max(6, Math.min(80, Number(e.target.value) || 6)) })} className="h-9" />
          </Field>
        </div>
        <p className="text-[11px] text-muted-foreground">Alterar palavras por bloco ou caracteres reagrupa as legendas a partir da transcrição (edições manuais de texto são perdidas).</p>
        <Row label="Emojis automáticos">
          <Switch checked={!!s.emojis} onCheckedChange={(v) => set({ emojis: v })} />
        </Row>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="flex h-9 items-center gap-2 rounded-lg border px-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-5 cursor-pointer rounded border-0 bg-transparent p-0" />
        <span className="font-mono text-[10px] uppercase text-muted-foreground">{value.replace("#", "")}</span>
      </span>
    </label>
  );
}

/* ---------- Brand Kit ---------- */

interface BrandKit {
  id: string;
  name: string;
  handle: string | null;
  primaryColor: string;
  secondaryColor: string;
  font: string;
  logoUrl: string | null;
}

function BrandPanel(p: SidebarProps) {
  const [kits, setKits] = useState<BrandKit[] | null>(null);
  useEffect(() => {
    api<{ data: BrandKit[] }>("/api/v1/brand-kits")
      .then((d) => setKits(d.data || []))
      .catch(() => setKits([]));
  }, []);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Aplique as cores e a fonte de um brand kit às legendas.</p>
      {kits === null ? <p className="text-xs text-muted-foreground">Carregando…</p> : null}
      {kits && !kits.length ? (
        <div className="rounded-xl border border-dashed px-4 py-8 text-center">
          <Palette className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Nenhum brand kit</p>
          <Button asChild size="sm" variant="secondary" className="mt-3">
            <Link href="/brand-kit">Criar brand kit</Link>
          </Button>
        </div>
      ) : null}
      {kits?.map((k) => (
        <button
          key={k.id}
          type="button"
          onClick={() => {
            p.onStyle({ fillColor: "#FFFFFF", highlightColor: k.primaryColor, accent2: k.secondaryColor, fontFamily: CAPTION_FONTS.includes(k.font) ? k.font : p.style.fontFamily });
            toast.success(`Brand kit "${k.name}" aplicado`);
          }}
          className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left hover:border-primary/60 hover:bg-secondary/60"
        >
          {k.logoUrl ? <img src={k.logoUrl} alt="" className="size-9 rounded-md object-cover" /> : <span className="size-9 rounded-md" style={{ background: `linear-gradient(135deg, ${k.primaryColor}, ${k.secondaryColor})` }} />}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{k.name}</span>
            <span className="block text-[11px] text-muted-foreground">
              {k.handle || "sem @"} · {k.font}
            </span>
          </span>
          <span className="flex gap-1">
            <span className="size-3 rounded-full border border-white/20" style={{ background: k.primaryColor }} />
            <span className="size-3 rounded-full border border-white/20" style={{ background: k.secondaryColor }} />
          </span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Arquivos ---------- */

function FilesPanel(p: SidebarProps) {
  return (
    <div className="space-y-3">
      <Button variant="secondary" className="w-full" onClick={p.onUploadClick}>
        <Plus /> Enviar arquivos
      </Button>
      {!p.files.length ? (
        <div className="rounded-xl border border-dashed px-4 py-8 text-center">
          <File className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Nenhum arquivo enviado</p>
          <p className="mt-1 text-xs text-muted-foreground">Imagens, vídeos e áudios enviados aparecem aqui.</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {p.files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
              {f.type.startsWith("image/") ? <img src={f.url} alt="" className="size-9 rounded object-cover" /> : <span className="flex size-9 items-center justify-center rounded bg-secondary text-muted-foreground">{f.type.startsWith("video/") ? <Play className="size-4" /> : <File className="size-4" />}</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{f.name}</span>
                <span className="block text-[11px] text-muted-foreground">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">Os arquivos ficam apenas nesta sessão do editor. Para guardá-los, use a Biblioteca.</p>
    </div>
  );
}

/* ---------- Áudio ---------- */

function AudioPanel() {
  const [q, setQ] = useState("");
  const music = MUSIC_TRACKS.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));
  const fx = SOUND_EFFECTS.filter((m) => m.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar música ou efeito…" className="h-9 pl-9" />
      </div>
      <Tabs defaultValue="musica">
        <TabsList className="h-9 w-full">
          <TabsTrigger value="musica" className="text-xs">
            Música ({MUSIC_TRACKS.length})
          </TabsTrigger>
          <TabsTrigger value="efeitos" className="text-xs">
            Efeitos ({SOUND_EFFECTS.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="musica" className="mt-3 space-y-1.5">
          {music.map((m) => (
            <AudioRow key={m.name} name={m.name} meta={`${m.mood} · ${m.duration}`} />
          ))}
        </TabsContent>
        <TabsContent value="efeitos" className="mt-3 space-y-1.5">
          {fx.map((m) => (
            <AudioRow key={m} name={m} meta="Efeito sonoro" />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AudioRow({ name, meta }: { name: string; meta: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
      <span className="flex size-8 items-center justify-center rounded-md bg-secondary text-muted-foreground">
        <Music className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{name}</span>
        <span className="block text-[11px] text-muted-foreground">{meta}</span>
      </span>
      <Tip label="Em breve">
        <span>
          <Button size="icon-sm" variant="secondary" disabled>
            <Plus />
          </Button>
        </span>
      </Tip>
    </div>
  );
}

/* ---------- Elementos ---------- */

function ElementsPanel(p: SidebarProps) {
  const [cat, setCat] = useState<"formas" | "emojis" | "sobreposicoes">("formas");
  const [color, setColor] = useState(SHAPE_COLORS[0]);
  return (
    <div className="space-y-4">
      <NativeSelect value={cat} onChange={(e) => setCat(e.target.value as typeof cat)} className="h-9 w-full">
        <option value="formas">Formas</option>
        <option value="emojis">Emojis</option>
        <option value="sobreposicoes">Sobreposições</option>
      </NativeSelect>
      {cat === "formas" ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {SHAPE_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} className={cn("size-6 rounded-full border-2", color === c ? "border-primary" : "border-white/10")} style={{ background: c }} title={c} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {SHAPES.map((s) => (
              <button key={s.kind} type="button" onClick={() => p.onAddShape({ kind: s.kind, label: s.label, color })} className="flex flex-col items-center gap-1.5 rounded-lg border p-3 text-[11px] hover:border-primary/60 hover:bg-secondary/60">
                <ShapeGlyph kind={s.kind} color={color} />
                {s.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {cat === "emojis" ? (
        <div className="grid grid-cols-4 gap-2">
          {ELEMENT_EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => p.onAddShape({ kind: "emoji", label: e, color: "#fff", text: e })} className="flex aspect-square items-center justify-center rounded-lg border text-2xl hover:border-primary/60 hover:bg-secondary/60">
              {e}
            </button>
          ))}
        </div>
      ) : null}
      {cat === "sobreposicoes" ? (
        <div className="space-y-1.5">
          {OVERLAYS.map((o) => (
            <label key={o.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span className="flex items-center gap-3">
                <span className="size-8 rounded-md border" style={{ background: `${o.css}, #333` }} />
                {o.label}
              </span>
              <Switch checked={p.activeOverlays.includes(o.id)} onCheckedChange={() => p.onToggleOverlay(o.id)} />
            </label>
          ))}
        </div>
      ) : null}
      <p className="text-[11px] text-muted-foreground">Elementos ficam na prévia desta sessão; arraste-os pelo canvas. A renderização final com elementos chega em breve.</p>
    </div>
  );
}

function ShapeGlyph({ kind, color }: { kind: string; color: string }) {
  const cls = "size-6";
  switch (kind) {
    case "square":
      return <span className={cls} style={{ background: color }} />;
    case "rounded":
      return <span className={cn(cls, "rounded-md")} style={{ background: color }} />;
    case "circle":
      return <span className={cn(cls, "rounded-full")} style={{ background: color }} />;
    case "triangle":
      return <span className={cls} style={{ background: color, clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }} />;
    case "star":
      return <span className={cls} style={{ background: color, clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)" }} />;
    case "line":
      return <span className="my-2.5 h-1 w-6" style={{ background: color }} />;
    case "arrow":
      return <span className={cls} style={{ background: color, clipPath: "polygon(0 35%, 60% 35%, 60% 10%, 100% 50%, 60% 90%, 60% 65%, 0 65%)" }} />;
    default:
      return (
        <svg viewBox="0 0 24 24" className={cls} fill={color}>
          <path d="M12 21s-7-4.5-9.5-9C.7 8.5 2.5 4 6.5 4c2 0 3.5 1 4.5 2.5C12 5 13.5 4 15.5 4c4 0 5.8 4.5 4 8-2.5 4.5-7.5 9-7.5 9z" />
        </svg>
      );
  }
}

/* ---------- Efeitos ---------- */

function EffectsPanel(p: SidebarProps) {
  const [cat, setCat] = useState<"filtros" | "transicoes" | "animacoes">("filtros");
  const [chip, setChip] = useState<(typeof FILTER_CATEGORIES)[number]["id"]>("all");
  const filters = useMemo(() => VIDEO_FILTERS.filter((f) => chip === "all" || f.category === chip), [chip]);
  return (
    <div className="space-y-4">
      <NativeSelect value={cat} onChange={(e) => setCat(e.target.value as typeof cat)} className="h-9 w-full">
        <option value="filtros">Filtros</option>
        <option value="transicoes">Transições</option>
        <option value="animacoes">Animações</option>
      </NativeSelect>
      {cat === "filtros" ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_CATEGORIES.map((c) => (
              <button key={c.id} type="button" onClick={() => setChip(c.id)} className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", chip === c.id ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <FilterTile name="Original" css="none" selected={!p.style.filter} onClick={() => p.onStyle({ filter: null })} />
            {filters.map((f) => (
              <FilterTile key={f.id} name={f.name} css={f.css} selected={p.style.filter === f.id} onClick={() => p.onStyle({ filter: f.id })} />
            ))}
          </div>
        </>
      ) : null}
      {cat !== "filtros" ? (
        <div className="grid grid-cols-2 gap-2">
          {(cat === "transicoes" ? TRANSITIONS : ANIMATIONS).map((n) => (
            <Tip key={n} label="Em breve">
              <span className="block">
                <button type="button" disabled className="w-full rounded-lg border px-3 py-3 text-xs text-muted-foreground opacity-60">
                  {n}
                </button>
              </span>
            </Tip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FilterTile({ name, css, selected, onClick }: { name: string; css: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex flex-col gap-1 text-left">
      <span className={cn("aspect-square w-full rounded-lg border bg-[linear-gradient(135deg,#f97316,#8b5cf6_50%,#22d3ee)]", selected ? "border-primary ring-2 ring-primary/40" : "group-hover:border-foreground/30")} style={{ filter: css }} />
      <span className={cn("truncate text-[11px]", selected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>{name}</span>
    </button>
  );
}

/* ---------- IA ---------- */

function AiPanel(p: SidebarProps) {
  const [loading, setLoading] = useState(false);
  const [voice, setVoice] = useState(VOICES[0].name);
  const [script, setScript] = useState("");
  const locked = !p.isSubscriber;

  async function genHook() {
    setLoading(true);
    try {
      const d = await api<{ hook: string; engine: string }>(`/api/v1/shorts/${p.shortId}/hook`, { method: "POST", json: {} });
      p.onHook(d.hook);
      toast.success(d.engine === "ai" ? "Hook gerado com IA" : "Hook sugerido a partir da transcrição");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold">Texto, narração e B-roll com IA</p>
        <p className="text-xs text-muted-foreground">Acelere a edição com hooks, imagens de apoio e voz gerados por IA.</p>
      </div>
      {locked ? (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Lock className="size-4 text-primary" /> Plano ativo necessário
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Hook e B-Roll com IA estão disponíveis em qualquer plano ativo.</p>
          <Button asChild size="sm" className="mt-3 w-full">
            <Link href="/financeiro?tab=plans">Ver planos</Link>
          </Button>
        </div>
      ) : null}

      <section className="space-y-2">
        <p className="flex items-center gap-2 text-xs font-semibold">
          <Sparkles className="size-3.5 text-primary" /> Gerar Hook
        </p>
        <Textarea value={p.hook || ""} onChange={(e) => p.onHook(e.target.value || null)} placeholder="Frase de abertura exibida nos 3 primeiros segundos" className="min-h-16 text-sm" maxLength={160} />
        <Button size="sm" className="w-full" variant={locked ? "secondary" : "default"} disabled={locked} loading={loading} onClick={genHook}>
          {locked ? "Plano Necessário" : "Gerar Hook"}
        </Button>
      </section>

      <section className="space-y-2">
        <p className="flex items-center gap-2 text-xs font-semibold">
          <Play className="size-3.5 text-primary" /> Gerar B-Roll
        </p>
        <p className="text-[11px] text-muted-foreground">Busca cenas de apoio combinando com o assunto do corte.</p>
        <Button size="sm" variant="secondary" className="w-full" disabled={locked} onClick={() => toast("Em breve", { description: "Busca de B-Roll chega em breve." })}>
          {locked ? "Plano Necessário" : "Buscar B-Roll"}
        </Button>
      </section>

      <section className="space-y-2">
        <p className="flex items-center gap-2 text-xs font-semibold">
          <Bot className="size-3.5 text-primary" /> Narração com IA
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {VOICES.map((v) => (
            <button key={v.name} type="button" onClick={() => setVoice(v.name)} className={cn("rounded-lg border px-2.5 py-2 text-left", voice === v.name ? "border-primary bg-primary/10" : "hover:bg-secondary/60")}>
              <span className="block text-xs font-semibold">{v.name}</span>
              <span className="block text-[10px] leading-tight text-muted-foreground">{v.desc}</span>
            </button>
          ))}
        </div>
        <Textarea value={script} onChange={(e) => setScript(e.target.value.slice(0, 200))} placeholder="Texto da narração…" className="min-h-16 text-sm" />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{script.length}/200</span>
          <Badge variant="purple">{voice}</Badge>
        </div>
        <Button size="sm" variant="secondary" className="w-full" disabled={locked || !script.trim()} onClick={() => toast("Em breve", { description: "Narração com IA chega em breve." })}>
          {locked ? "Plano Necessário" : "Gerar narração"}
        </Button>
      </section>
    </div>
  );
}
