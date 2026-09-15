"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Clock, Link2, Lock, Sparkles, Upload, Info, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api, useUser } from "@/lib/hooks";
import { cn, formatDuration } from "@/lib/utils";
import { CAPTION_FONTS, CAPTION_STYLES, CLIP_DURATIONS, getCaptionStyle, type CaptionStyle } from "@/lib/caption-styles";
import { EFFECT_PRESETS } from "@/lib/effects";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/progress";
import { CaptionPreview, StyleTile } from "@/components/caption-preview";
import type { VideoMetadata } from "@/lib/video/ytdlp";

export default function CriarProjetoPage() {
  return (
    <Suspense>
      <Wizard />
    </Suspense>
  );
}

function Wizard() {
  const sp = useSearchParams();
  const router = useRouter();
  const { user, refresh } = useUser();
  const [step, setStep] = useState(0);
  const [url, setUrl] = useState(sp.get("url") || "");
  const [meta, setMeta] = useState<VideoMetadata | null>(null);
  const [checking, setChecking] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [clipDuration, setClipDuration] = useState("auto");
  const [range, setRange] = useState<[number, number] | null>(null);
  const [styleId, setStyleId] = useState(sp.get("style") || "green-fresh");
  const [font, setFont] = useState(sp.get("font") || "Montserrat");
  const [emojis, setEmojis] = useState(false);
  const [autoCta, setAutoCta] = useState(false);
  const [effectsPreset, setEffectsPreset] = useState("viral");
  const [handle, setHandle] = useState("");
  const [useCredits, setUseCredits] = useState(false);
  const [creating, setCreating] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialTitle = sp.get("title");

  const freeLeft = user?.freeClipsLeft ?? 3;
  const subscriber = !!user?.isSubscriber;
  const style: CaptionStyle = useMemo(() => ({ ...getCaptionStyle(styleId), fontFamily: font }), [styleId, font]);
  const duration = meta?.durationSec || 0;
  const [start, end] = range || [0, duration];
  const minutes = Math.max(1, Math.ceil((end - start) / 60));
  const willUseFree = !subscriber && freeLeft > 0 && !useCredits;
  const clipsPlanned = willUseFree ? Math.min(freeLeft, meta?.estimatedClips || 3) : meta?.estimatedClips || 3;

  // valida o link enquanto digita
  useEffect(() => {
    if (!url.trim() || file) {
      setMeta(null);
      setUrlError(null);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setChecking(true);
      try {
        const d = await api<{ data: VideoMetadata }>("/api/v1/videoMetadata", { method: "POST", json: { url: url.trim(), clipDuration } });
        setMeta(d.data);
        setRange([0, d.data.durationSec]);
        setUrlError(null);
      } catch (e) {
        setMeta(null);
        setUrlError((e as Error).message);
      } finally {
        setChecking(false);
      }
    }, 600);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, file]);

  async function upload(f: File) {
    if (!subscriber) return toast.error("Enviar arquivos do computador é exclusivo dos planos. Assine para desbloquear o upload.");
    setFile(f);
    setUploadPct(0);
    const fd = new FormData();
    fd.append("file", f);
    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/v1/upload");
      xhr.upload.onprogress = (ev) => setUploadPct(Math.round((ev.loaded / ev.total) * 100));
      xhr.onload = () => {
        try {
          const d = JSON.parse(xhr.responseText);
          if (xhr.status >= 400) throw new Error(d.error || "Falha no upload");
          setSourcePath(d.path);
          setMeta({ ...d.meta, estimatedClips: d.meta.estimatedClips || 3 });
          setRange([0, d.meta.durationSec]);
        } catch (e) {
          toast.error((e as Error).message);
          setFile(null);
        }
        setUploadPct(null);
        resolve();
      };
      xhr.onerror = () => {
        toast.error("Falha no upload");
        setFile(null);
        setUploadPct(null);
        resolve();
      };
      xhr.send(fd);
    });
  }

  async function create() {
    setCreating(true);
    try {
      const d = await api<{ project: { id: string } }>("/api/v1/projects", {
        method: "POST",
        json: {
          url: file ? undefined : url.trim(),
          sourcePath: sourcePath || undefined,
          title: initialTitle || meta?.title,
          clipDuration,
          layout: "auto",
          captionTemplate: style,
          captionStyleId: styleId,
          captionFont: font,
          emojisEnabled: emojis,
          autoCta,
          effects: { preset: effectsPreset, handle: handle.trim() || null },
          ignoreCaptions: styleId === "none",
          startTime: start,
          endTime: end,
          useMyCredits: useCredits,
        },
      });
      await refresh();
      router.push(`/projects/${d.project.id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setCreating(false);
    }
  }

  const canNext = step === 0 ? !!meta && !checking : true;

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col px-4 py-6 md:px-8">
      <div className="relative flex-1 overflow-hidden rounded-3xl border bg-card">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(0,212,255,0.28),transparent_65%)]" />
        <div className="scrollbar-thin relative h-full overflow-y-auto px-6 py-10 md:px-12">
          {step === 0 ? (
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="display text-4xl">Cole o link do vídeo</h1>
              <p className="mt-3 text-muted-foreground">Cole um link do YouTube, Twitch, Kick ou Google Drive, envie um arquivo do seu computador ou use um exemplo para testar.</p>
              <div className={cn("mt-8 flex items-center gap-3 rounded-2xl border bg-background/60 px-4 py-3 transition", meta ? "border-success/60 glow" : urlError ? "border-destructive/60" : "glow")}>
                <Link2 className="size-5 text-muted-foreground" />
                <input
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setFile(null);
                    setSourcePath(null);
                  }}
                  placeholder="Cole um link do YouTube, Twitch, Kick ou Google Drive"
                  className="h-10 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/60"
                />
                {checking ? <Spinner /> : meta ? <CheckCircle2 className="size-5 text-success" /> : null}
              </div>
              {urlError ? <p className="mt-2 text-sm text-destructive">{urlError}</p> : null}
              {meta ? <VideoCard meta={meta} clips={clipsPlanned} styleName={style.fontFamily} /> : null}

              <label className={cn("mt-6 flex cursor-pointer items-center gap-4 rounded-2xl border bg-background/40 px-5 py-4 text-left", !subscriber && "opacity-60")}>
                <Upload className="size-6 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{subscriber ? "Envie seu arquivo" : "Upload disponível apenas para assinantes"}</p>
                  <p className="text-xs text-muted-foreground">{subscriber ? "MP4, MOV ou WEBM de até 4 GB." : "Enviar arquivos do computador é exclusivo dos planos. Assine para desbloquear o upload."}</p>
                  {uploadPct !== null ? <p className="mt-1 text-xs text-primary">Enviando… {uploadPct}%</p> : file && sourcePath ? <p className="mt-1 text-xs text-success">{file.name} enviado ✓</p> : null}
                </div>
                {!subscriber ? <Lock className="size-4 text-muted-foreground" /> : null}
                <input type="file" accept="video/*" className="hidden" disabled={!subscriber} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </label>
              <p className="mt-6 text-sm text-muted-foreground">Use apenas vídeos que você criou ou tem permissão para usar.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <span className="text-xs text-muted-foreground">Exemplos:</span>
                {[
                  ["TEDx · Will Stephen", "https://www.youtube.com/watch?v=8S0FDjFBj8o"],
                  ["Simon Sinek · Why", "https://www.youtube.com/watch?v=u4ZoJKF_VuA"],
                ].map(([l, u]) => (
                  <button key={u} onClick={() => setUrl(u)} className="rounded-full border px-3 py-1 text-xs hover:bg-secondary">
                    {l}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="mx-auto max-w-3xl">
              {meta ? <VideoCard meta={meta} clips={clipsPlanned} styleName={style.fontFamily} compact /> : null}
              <h1 className="display mt-8 text-center text-4xl">Ajuste a duração do seu vídeo</h1>
              <p className="mt-3 text-center text-muted-foreground">Defina a duração de cada corte e até que parte do vídeo a IA deve analisar para encontrar os melhores momentos.</p>
              <p className="mt-8 text-sm text-muted-foreground">Duração de cada corte</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {CLIP_DURATIONS.map((d) => {
                  const locked = d.pro && !subscriber;
                  return (
                    <button
                      key={d.id}
                      disabled={locked}
                      onClick={() => setClipDuration(d.id)}
                      className={cn("flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition", clipDuration === d.id ? "border-primary bg-primary/10 text-primary" : "hover:bg-secondary", locked && "cursor-not-allowed opacity-50")}
                    >
                      {d.id === "auto" ? <Sparkles className="size-4" /> : null}
                      {d.label}
                      {locked ? <Lock className="size-3.5" /> : null}
                    </button>
                  );
                })}
              </div>
              {duration > 0 ? (
                <div className="mt-8">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Trecho analisado</span>
                    <span className="font-mono">
                      {formatDuration(start)} – {formatDuration(end)} · {minutes} min
                    </span>
                  </div>
                  <RangeSlider min={0} max={duration} value={[start, end]} onChange={(v) => setRange(v)} />
                </div>
              ) : null}
              <div className={cn("mt-8 flex items-center gap-4 rounded-2xl border px-5 py-4", willUseFree ? "border-primary/40 bg-primary/10" : "bg-background/40")}>
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-white">
                  <Clock className="size-5" />
                </span>
                <div className="flex-1">
                  {willUseFree ? (
                    <>
                      <p className="text-sm font-semibold">{clipsPlanned} cortes rápidos para você experimentar</p>
                      <p className="text-xs text-muted-foreground">Seus {freeLeft} primeiros cortes são grátis para você testar.</p>
                      <div className="mt-2 flex gap-1.5">
                        {Array.from({ length: clipsPlanned }).map((_, i) => (
                          <span key={i} className="h-1 w-24 rounded-full bg-primary" />
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold">Custo estimado: {minutes} créditos</p>
                      <p className="text-xs text-muted-foreground">1 crédito por minuto analisado · Até {meta?.estimatedClips || 3} cortes · Você tem {user?.credits ?? 0} créditos.</p>
                    </>
                  )}
                </div>
                {!subscriber && freeLeft > 0 ? (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    Usar meus créditos
                    <Switch checked={useCredits} onCheckedChange={setUseCredits} />
                  </label>
                ) : null}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="mx-auto max-w-5xl">
              {meta ? <VideoCard meta={meta} clips={clipsPlanned} styleName={style.fontFamily} compact /> : null}
              <h1 className="display mt-8 text-center text-4xl">Como suas legendas vão aparecer?</h1>
              <p className="mt-3 text-center text-muted-foreground">Toque num estilo e veja ao vivo no seu vídeo. Dá pra ajustar tudo depois no editor.</p>
              <div className="mt-8 grid gap-8 md:grid-cols-[280px_1fr]">
                <div>
                  <CaptionPreview style={style} handle={meta?.channelTitle ? "@" + meta.channelTitle.toLowerCase().replace(/\s+/g, "") : "@seucanal"} />
                  <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                    <Info className="mt-0.5 size-3.5 shrink-0" /> Fique tranquilo: você poderá alterar tudo depois, direto no editor.
                  </p>
                </div>
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold">Mais usados</p>
                    <NativeSelect value={font} onChange={(e) => setFont(e.target.value)} className="h-9">
                      {CAPTION_FONTS.map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {CAPTION_STYLES.map((s) => (
                      <StyleTile key={s.id} style={{ ...s, fontFamily: font }} selected={styleId === s.id} onClick={() => setStyleId(s.id)} />
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      <Switch checked={emojis} onCheckedChange={setEmojis} /> 😀 Habilitar Emojis
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      <Switch checked={autoCta} onCheckedChange={setAutoCta} /> 📣 Habilitar Gancho Visual
                    </label>
                  </div>

                  <p className="mt-8 text-sm text-muted-foreground">Efeitos de transformação</p>
                  <p className="mt-1 text-xs text-muted-foreground">Zoom, cor, barra de progresso, marca e velocidade dão identidade própria ao corte (o que as plataformas olham pra considerar conteúdo original).</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {EFFECT_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setEffectsPreset(p.id)}
                        className={cn("rounded-xl border px-4 py-3 text-left transition", effectsPreset === p.id ? "border-primary bg-primary/10" : "hover:bg-secondary")}
                      >
                        <div className={cn("text-sm font-semibold", effectsPreset === p.id && "text-primary")}>{p.name}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{p.description}</div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3">
                    <label className="text-xs text-muted-foreground">@ do canal (aparece fixo no corte)</label>
                    <input
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      placeholder="@seucanal"
                      className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-auto mt-4 w-full max-w-3xl">
        <div className="mb-3 grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn("h-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Button variant="secondary" size="xl" onClick={() => (step === 0 ? router.back() : setStep((s) => s - 1))}>
            Voltar
          </Button>
          {step < 2 ? (
            <Button size="xl" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Próximo <ChevronRight />
            </Button>
          ) : (
            <Button size="xl" onClick={create} loading={creating}>
              Criar Projeto <ChevronRight />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function VideoCard({ meta, clips, styleName, compact }: { meta: VideoMetadata; clips: number; styleName: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-4 rounded-2xl border bg-background/50 p-3 text-left", compact ? "" : "mt-6")}>
      {meta.thumbnailUrl ? <img src={meta.thumbnailUrl} alt="" className="h-16 w-28 rounded-lg object-cover" /> : <div className="h-16 w-28 rounded-lg bg-secondary" />}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-semibold">{meta.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {meta.channelTitle || "Arquivo enviado"} · {formatDuration(meta.durationSec)} · até {clips} cortes
        </p>
        <div className="mt-2 flex gap-1.5">
          {["Auto", "9:16", styleName].map((t) => (
            <span key={t} className="rounded-md border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function RangeSlider({ min, max, value, onChange }: { min: number; max: number; value: [number, number]; onChange: (v: [number, number]) => void }) {
  const [a, b] = value;
  const pct = (v: number) => ((v - min) / Math.max(1, max - min)) * 100;
  return (
    <div className="relative mt-3 h-8">
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
      <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary" style={{ left: `${pct(a)}%`, right: `${100 - pct(b)}%` }} />
      <input type="range" min={min} max={max} step={1} value={a} onChange={(e) => onChange([Math.min(Number(e.target.value), b - 10), b])} className="range-thumb absolute inset-0 w-full appearance-none bg-transparent" />
      <input type="range" min={min} max={max} step={1} value={b} onChange={(e) => onChange([a, Math.max(Number(e.target.value), a + 10)])} className="range-thumb absolute inset-0 w-full appearance-none bg-transparent" />
      <style>{`.range-thumb{pointer-events:none}.range-thumb::-webkit-slider-thumb{pointer-events:auto;appearance:none;width:18px;height:18px;border-radius:999px;background:var(--primary);border:3px solid #fff;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.4)}`}</style>
    </div>
  );
}
