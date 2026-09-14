"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Grid3x3, Ruler } from "lucide-react";
import { toast } from "sonner";
import { api, useUser } from "@/lib/hooks";
import { Spinner } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CAPTION_FONTS_URL, FPS } from "./constants";
import { applyPreset, glueGroups, initialStyle, mergeGroups, reconcileCaptions, regroup, retimeGroup, setGroupText, splitGroups, findGroupIndex } from "./captions";
import { useHistory } from "./stores";
import { usePlayer } from "./use-player";
import { TipProvider, Tip, ToolButton } from "./menu";
import { TopBar } from "./top-bar";
import { Preview } from "./preview";
import { Transport } from "./transport";
import { TimelineToolbar } from "./timeline-toolbar";
import { Timeline } from "./timeline";
import { Sidebar } from "./sidebar";
import type { EditorState, EditorStyle, GuideId, PanelId, ShapeOverlay, ShortRecord, ShortResponse, UploadedFile } from "./types";

export function Editor({ projectId, shortId }: { projectId: string; shortId: string }) {
  const [data, setData] = useState<ShortResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gen, setGen] = useState(0);

  const load = useCallback(async () => {
    try {
      const d = await api<ShortResponse>(`/api/v1/shorts/${shortId}`);
      setData(d);
      setError(null);
      setGen((g) => g + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [shortId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#0b0b0d] text-sm">
        <p className="text-destructive">{error}</p>
        <Button variant="secondary" onClick={() => window.history.back()}>
          Voltar
        </Button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center gap-3 bg-[#0b0b0d] text-sm text-muted-foreground">
        <Spinner /> Carregando editor…
      </div>
    );
  }
  return <EditorInner key={gen} projectId={projectId} data={data} onReload={load} />;
}

function buildState(short: ShortRecord): EditorState {
  return {
    title: short.title,
    layout: short.layout || "single",
    startTime: short.startTime,
    endTime: short.endTime,
    style: initialStyle(short),
    captions: short.captions || [],
    hook: short.hook,
    shapes: [],
  };
}

function persisted(s: EditorState) {
  return JSON.stringify({ title: s.title, layout: s.layout, startTime: s.startTime, endTime: s.endTime, captionTemplate: s.style, captions: s.captions, hook: s.hook });
}

function EditorInner({ projectId, data, onReload }: { projectId: string; data: ShortResponse; onReload: () => void }) {
  const router = useRouter();
  const { user } = useUser();
  const isSubscriber = !!user?.isSubscriber;
  const words = data.words;
  const [short, setShort] = useState(data.short);
  const initial = useMemo(() => buildState(data.short), [data.short]);
  const h = useHistory<EditorState>(initial);
  const s = h.state;
  const player = usePlayer(s.startTime, s.endTime);
  const durationSec = Math.max(short.project.durationSec || 0, s.endTime);

  // ui
  const [panel, setPanel] = useState<PanelId | null>("texto");
  const [imax, setImax] = useState(false);
  const [guide, setGuide] = useState<GuideId>("none");
  const [rulers, setRulers] = useState(false);
  const [guides, setGuides] = useState(false);
  const [previewZoom, setPreviewZoom] = useState<number | "fit">("fit");
  const [viewMode, setViewMode] = useState<"fit" | "whole">("fit");
  const [tlZoom, setTlZoom] = useState(1);
  const [magnet, setMagnet] = useState(true);
  const [applyAll, setApplyAll] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedShape, setSelectedShape] = useState<string | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [overlays, setOverlays] = useState<string[]>([]);
  const [captionsHidden, setCaptionsHidden] = useState(false);
  const [videoHidden, setVideoHidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(persisted(s));
  const dragOrigin = useRef<[number, number] | null>(null);
  const previewWrap = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const serialized = useMemo(() => persisted(s), [s]);
  const dirty = serialized !== savedRef.current;

  const src = short.project.sourcePath ? `/api/files/projects/${projectId}/source.mp4` : null;

  const view = useMemo(() => {
    if (viewMode === "whole") return { from: 0, to: Math.max(durationSec, 1) };
    const margin = Math.max(2, (s.endTime - s.startTime) * 0.12);
    return { from: Math.max(0, s.startTime - margin), to: Math.min(Math.max(durationSec, s.endTime), s.endTime + margin) };
  }, [viewMode, durationSec, s.startTime, s.endTime]);

  /* ---------- ações ---------- */

  const setStyle = useCallback(
    (patch: Partial<EditorStyle>) => {
      h.update((prev) => {
        const style = { ...prev.style, ...patch };
        const regroupNeeded = (patch.wordsPerGroup !== undefined && patch.wordsPerGroup !== prev.style.wordsPerGroup) || (patch.maxChars !== undefined && patch.maxChars !== prev.style.maxChars);
        return { ...prev, style, captions: regroupNeeded ? regroup(words, prev.startTime, prev.endTime, style) : prev.captions };
      });
    },
    [h, words],
  );

  const setPreset = useCallback(
    (id: string) => {
      h.update((prev) => {
        const style = applyPreset(prev.style, id);
        const changed = style.wordsPerGroup !== prev.style.wordsPerGroup || style.maxChars !== prev.style.maxChars;
        return { ...prev, style, captions: changed ? regroup(words, prev.startTime, prev.endTime, style) : prev.captions };
      });
    },
    [h, words],
  );

  const setRange = useCallback(
    (start: number, end: number) => {
      h.update((prev) => ({ ...prev, startTime: start, endTime: end, captions: reconcileCaptions(prev.captions, words, [prev.startTime, prev.endTime], [start, end], prev.style) }));
    },
    [h, words],
  );

  const onDragStart = useCallback(() => {
    h.snapshot();
    dragOrigin.current = [s.startTime, s.endTime];
  }, [h, s.startTime, s.endTime]);

  const onTrim = useCallback(
    (start: number, end: number, commit: boolean) => {
      h.update((prev) => {
        if (!commit) return { ...prev, startTime: start, endTime: end };
        const origin = dragOrigin.current || [prev.startTime, prev.endTime];
        return { ...prev, startTime: start, endTime: end, captions: reconcileCaptions(prev.captions, words, origin, [start, end], prev.style) };
      }, "replace");
    },
    [h, words],
  );

  const split = useCallback(() => {
    const t = player.time.get();
    h.update((prev) => {
      const r = splitGroups(prev.captions, t);
      if (!r) {
        toast("Posicione o cursor dentro de uma legenda para cortar.");
        return prev;
      }
      setSelected(r.index);
      return { ...prev, captions: r.groups };
    });
  }, [h, player.time]);

  const merge = useCallback(() => {
    h.update((prev) => {
      const i = selected ?? findGroupIndex(prev.captions, player.time.get());
      if (i < 0 || i >= prev.captions.length - 1) {
        toast("Selecione uma legenda que tenha uma seguinte para juntar.");
        return prev;
      }
      setSelected(i);
      return { ...prev, captions: mergeGroups(prev.captions, i) };
    });
  }, [h, selected, player.time]);

  const glue = useCallback(() => {
    h.update((prev) => ({ ...prev, captions: glueGroups(prev.captions) }));
    toast.success("Espaços entre legendas fechados");
  }, [h]);

  const onGroupRetime = useCallback((i: number, start: number, end: number) => h.update((prev) => ({ ...prev, captions: prev.captions.map((g, k) => (k === i ? retimeGroup(g, start, end) : g)) }), "replace"), [h]);
  const onGroupText = useCallback((i: number, text: string) => h.update((prev) => ({ ...prev, captions: prev.captions.map((g, k) => (k === i ? setGroupText(g, text) : g)) })), [h]);

  const toggleMotion = useCallback(
    (i: number) =>
      h.update((prev) => {
        const fm = { ...(prev.style.faceMotion || {}) };
        fm[String(i)] = !fm[String(i)];
        return { ...prev, style: { ...prev.style, faceMotion: fm } };
      }),
    [h],
  );

  const addShape = useCallback(
    (sh: Omit<ShapeOverlay, "id" | "x" | "y" | "w" | "h">) => {
      const id = Math.random().toString(36).slice(2, 9);
      const isLine = sh.kind === "line";
      h.update((prev) => ({ ...prev, shapes: [...prev.shapes, { ...sh, id, x: 35, y: 40, w: isLine ? 50 : 30, h: isLine ? 6 : 17 }] }));
      setSelectedShape(id);
    },
    [h],
  );
  const moveShape = useCallback(
    (id: string, x: number, y: number, phase: "start" | "move" | "end") => {
      if (phase === "start") return h.snapshot();
      if (phase === "move") h.update((prev) => ({ ...prev, shapes: prev.shapes.map((sh) => (sh.id === id ? { ...sh, x, y } : sh)) }), "replace");
    },
    [h],
  );
  const removeShape = useCallback(
    (id: string) => {
      h.update((prev) => ({ ...prev, shapes: prev.shapes.filter((sh) => sh.id !== id) }));
      setSelectedShape(null);
    },
    [h],
  );

  const autoEdit = useCallback(() => {
    h.update((prev) => ({ ...prev, layout: "single", captions: regroup(words, prev.startTime, prev.endTime, prev.style) }));
    toast.success("Auto Edit aplicado: layout Single e legendas reagrupadas");
  }, [h, words]);

  const save = useCallback(async (): Promise<boolean> => {
    if (!dirty) return true;
    setSaving(true);
    try {
      const body = { title: s.title, layout: s.layout, startTime: s.startTime, endTime: s.endTime, captionTemplate: s.style as unknown as Record<string, unknown>, captions: s.captions, hook: s.hook };
      const d = await api<{ short: ShortRecord }>(`/api/v1/shorts/${short.id}`, { method: "PATCH", json: body });
      savedRef.current = persisted(s);
      setShort((prev) => ({ ...prev, ...d.short, project: prev.project }));
      toast.success("Alterações salvas");
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [dirty, s, short.id]);

  const leave = useCallback(
    (href: string) => {
      if (dirty && !confirm("Você tem alterações não salvas. Sair mesmo assim?")) return;
      router.push(href);
    },
    [dirty, router],
  );

  const onUpload = useCallback((list: FileList) => {
    const added: UploadedFile[] = Array.from(list).map((f) => ({ id: Math.random().toString(36).slice(2, 9), name: f.name, size: f.size, type: f.type, url: URL.createObjectURL(f) }));
    setFiles((prev) => [...added, ...prev]);
    setPanel("arquivos");
    toast.success(`${added.length} arquivo(s) adicionado(s)`);
  }, []);

  /* ---------- efeitos globais ---------- */

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);

  const actions = useRef({ undo: h.undo, redo: h.redo, save, split, toggle: player.toggle, step: player.step, seekRel: player.seekRel, seek: player.seek, removeShape, selectedShape, endTime: s.endTime });
  actions.current = { undo: h.undo, redo: h.redo, save, split, toggle: player.toggle, step: player.step, seekRel: player.seekRel, seek: player.seek, removeShape, selectedShape, endTime: s.endTime };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const a = actions.current;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) a.redo();
        else a.undo();
        return;
      }
      if (mod && k === "y") {
        e.preventDefault();
        a.redo();
        return;
      }
      if (mod && k === "s") {
        e.preventDefault();
        a.save();
        return;
      }
      if (mod) return;
      switch (e.code) {
        case "Space":
          e.preventDefault();
          a.toggle();
          break;
        case "KeyS":
          e.preventDefault();
          a.split();
          break;
        case "ArrowLeft":
          e.preventDefault();
          a.step(e.shiftKey ? -1 : -1 / FPS);
          break;
        case "ArrowRight":
          e.preventDefault();
          a.step(e.shiftKey ? 1 : 1 / FPS);
          break;
        case "Home":
          e.preventDefault();
          a.seekRel(0);
          break;
        case "End":
          e.preventDefault();
          a.seek(a.endTime);
          break;
        case "Delete":
        case "Backspace":
          if (a.selectedShape) {
            e.preventDefault();
            a.removeShape(a.selectedShape);
          }
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- render ---------- */

  return (
    <TipProvider>
      <link rel="stylesheet" href={CAPTION_FONTS_URL} precedence="default" />
      <div className="flex h-screen flex-col overflow-hidden bg-[#0b0b0d] text-foreground dark">
        <TopBar
          projectId={projectId}
          shortId={short.id}
          short={short}
          title={s.title}
          onTitle={(t) => h.update((prev) => ({ ...prev, title: t }))}
          canUndo={h.canUndo}
          canRedo={h.canRedo}
          onUndo={h.undo}
          onRedo={h.redo}
          dirty={dirty}
          saving={saving}
          onSave={save}
          onUpload={onUpload}
          isSubscriber={isSubscriber}
          onAutoEdit={autoEdit}
          imax={imax}
          onImax={(v) => {
            setImax(v);
            if (v) setPanel(null);
          }}
          onReset={onReload}
          onLeave={leave}
          onShortUpdate={(patch) => setShort((prev) => ({ ...prev, ...patch }))}
        />

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            {/* barra da prévia */}
            <div className="flex h-10 shrink-0 items-center gap-1 border-b bg-[#0f0f11] px-3">
              <Tip label="Réguas">
                <ToolButton active={rulers} onClick={() => setRulers((v) => !v)}>
                  <Ruler />
                </ToolButton>
              </Tip>
              <Tip label="Guias (terços e centro)">
                <ToolButton active={guides} onClick={() => setGuides((v) => !v)}>
                  <Grid3x3 />
                </ToolButton>
              </Tip>
              <NativeSelect value={String(previewZoom)} onChange={(e) => setPreviewZoom(e.target.value === "fit" ? "fit" : Number(e.target.value))} className="h-7 rounded-md px-2 text-xs">
                <option value="fit">Ajustar</option>
                <option value="0.5">50%</option>
                <option value="0.75">75%</option>
                <option value="1">100%</option>
                <option value="1.5">150%</option>
                <option value="2">200%</option>
              </NativeSelect>
              <div className="flex-1" />
              {short.status === "rendered" ? <Badge variant="success">Renderizado</Badge> : null}
              <Badge variant="mono">Prévia em baixa resolução</Badge>
            </div>

            <div ref={previewWrap} className="flex min-h-0 flex-1 flex-col bg-[#0b0b0d]">
              <Preview
                src={videoHidden ? null : src}
                poster={short.thumbnailUrl || short.project.thumbnailUrl}
                player={player}
                layout={s.layout}
                style={s.style}
                captions={captionsHidden ? [] : s.captions}
                hook={captionsHidden ? null : s.hook}
                startTime={s.startTime}
                shapes={s.shapes}
                selectedShape={selectedShape}
                onSelectShape={setSelectedShape}
                onMoveShape={moveShape}
                onRemoveShape={removeShape}
                activeOverlays={overlays}
                guide={guide}
                rulers={rulers}
                guides={guides}
                zoom={previewZoom}
                imax={imax}
              />
            </div>

            <Transport player={player} startTime={s.startTime} endTime={s.endTime} onFullscreen={() => previewWrap.current?.requestFullscreen?.()} />

            <TimelineToolbar
              player={player}
              words={words}
              startTime={s.startTime}
              endTime={s.endTime}
              durationSec={durationSec}
              captions={s.captions}
              faceMotion={s.style.faceMotion || {}}
              layout={s.layout}
              applyAll={applyAll}
              guide={guide}
              magnet={magnet}
              zoom={tlZoom}
              onSplit={split}
              onMerge={merge}
              onGlue={glue}
              onMagnet={setMagnet}
              onExpand={() => {
                const ns = Math.max(0, s.startTime - 3);
                const ne = Math.min(durationSec || s.endTime + 3, s.endTime + 3);
                if (ns === s.startTime && ne === s.endTime) return toast("O corte já ocupa o vídeo inteiro.");
                setRange(ns, ne);
                toast.success("Corte expandido em 3s para cada lado");
              }}
              onExtendRange={(ns, ne) => {
                setRange(ns, ne);
                toast.success("Trecho adicionado ao corte");
              }}
              onToggleMotion={toggleMotion}
              onGuide={setGuide}
              onLayout={(id) => h.update((prev) => ({ ...prev, layout: id }))}
              onApplyAll={setApplyAll}
              onViewWhole={() => {
                setViewMode("whole");
                setTlZoom(1);
              }}
              onFitSelection={() => {
                setViewMode("fit");
                setTlZoom(1);
              }}
              onZoom={setTlZoom}
            />

            <div className={imax ? "h-32 shrink-0" : "h-44 shrink-0"}>
              <Timeline
                player={player}
                startTime={s.startTime}
                endTime={s.endTime}
                durationSec={durationSec}
                captions={s.captions}
                selected={selected}
                onSelect={setSelected}
                thumbnailUrl={short.thumbnailUrl}
                magnet={magnet}
                view={view}
                zoom={tlZoom}
                captionsHidden={captionsHidden}
                videoHidden={videoHidden}
                onToggleCaptionsHidden={() => setCaptionsHidden((v) => !v)}
                onToggleVideoHidden={() => setVideoHidden((v) => !v)}
                onDragStart={onDragStart}
                onGroupRetime={onGroupRetime}
                onGroupText={onGroupText}
                onTrim={onTrim}
              />
            </div>
          </div>

          <Sidebar
            panel={panel}
            onPanel={setPanel}
            style={s.style}
            onStyle={setStyle}
            onPreset={setPreset}
            applyAll={applyAll}
            onApplyAll={setApplyAll}
            files={files}
            onUploadClick={() => uploadRef.current?.click()}
            onAddShape={addShape}
            activeOverlays={overlays}
            onToggleOverlay={(id) => setOverlays((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
            isSubscriber={isSubscriber}
            shortId={short.id}
            hook={s.hook}
            onHook={(hk) => h.update((prev) => ({ ...prev, hook: hk }))}
          />
        </div>
        <input ref={uploadRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && onUpload(e.target.files)} />
      </div>
    </TipProvider>
  );
}
