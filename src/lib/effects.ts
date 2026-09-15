/**
 * Efeitos de transformação aplicados no render.
 * Objetivo: cada corte sair com identidade própria (zoom, cor, marca, ritmo)
 * em vez de ser só um recorte do vídeo original.
 */
export interface EffectsConfig {
  /** Zoom dinâmico: pulse = respira suave; punch = corte seco alternado (estilo viral) */
  zoom: "none" | "pulse" | "punch";
  /** Intervalo do ciclo de zoom em segundos */
  zoomIntervalSec: number;
  /** Intensidade do zoom (0.06 = 6%) */
  zoomAmount: number;
  /** Barra de progresso na base do vídeo */
  progressBar: boolean;
  progressColor: string;
  /** Tratamento de cor */
  grade: "none" | "warm" | "punchy" | "cinematic" | "cool";
  vignette: boolean;
  /** @handle fixo no canto (identidade do canal) */
  handle: string | null;
  handleColor: string;
  /** Cartão final: texto grande nos últimos N segundos */
  endCardText: string | null;
  endCardSeconds: number;
  /** Força o gancho visual nos 3 primeiros segundos (usa hook da IA ou o título) */
  hook: boolean;
  /** Espelha horizontalmente (muda a impressão digital do vídeo; evite se houver texto na tela) */
  mirror: boolean;
  /** Velocidade 1.00–1.10 (áudio com pitch preservado) */
  speed: number;
  /** Trilha de fundo: caminho absoluto de um áudio livre + volume (0–1) */
  musicPath: string | null;
  musicVolume: number;
}

export const DEFAULT_EFFECTS: EffectsConfig = {
  zoom: "none",
  zoomIntervalSec: 4,
  zoomAmount: 0.06,
  progressBar: false,
  progressColor: "#76FF03",
  grade: "none",
  vignette: false,
  handle: null,
  handleColor: "#FFFFFF",
  endCardText: null,
  endCardSeconds: 2.5,
  hook: false,
  mirror: false,
  speed: 1,
  musicPath: null,
  musicVolume: 0.12,
};

export interface EffectsPreset {
  id: string;
  name: string;
  description: string;
  config: Partial<EffectsConfig>;
}

export const EFFECT_PRESETS: EffectsPreset[] = [
  { id: "none", name: "Sem efeitos", description: "Só recorte + legendas", config: {} },
  {
    id: "viral",
    name: "Viral",
    description: "Punch zoom, cor vibrante, barra de progresso e gancho",
    config: { zoom: "punch", zoomIntervalSec: 3.5, zoomAmount: 0.08, progressBar: true, grade: "punchy", hook: true },
  },
  {
    id: "cinematic",
    name: "Cinematic",
    description: "Zoom suave, tom cinematográfico, vinheta e cartão final",
    config: { zoom: "pulse", zoomIntervalSec: 6, zoomAmount: 0.05, grade: "cinematic", vignette: true, hook: true, endCardText: "Segue pra parte 2", endCardSeconds: 2.5 },
  },
  {
    id: "monetize",
    name: "Monetizável",
    description: "Máxima transformação: zoom, cor, marca, barra, gancho, velocidade 1.04 e cartão final",
    config: {
      zoom: "punch",
      zoomIntervalSec: 4,
      zoomAmount: 0.07,
      progressBar: true,
      grade: "warm",
      vignette: true,
      hook: true,
      speed: 1.04,
      endCardText: "Segue pra mais cortes",
      endCardSeconds: 2.5,
    },
  },
  {
    id: "stealth",
    name: "Stealth",
    description: "Monetizável + espelhado (só use se não houver texto na tela do vídeo original)",
    config: {
      zoom: "pulse",
      zoomIntervalSec: 5,
      zoomAmount: 0.06,
      progressBar: true,
      grade: "cool",
      vignette: true,
      hook: true,
      speed: 1.05,
      mirror: true,
      endCardText: "Segue pra mais cortes",
      endCardSeconds: 2.5,
    },
  },
];

export function getEffectsPreset(id: string) {
  return EFFECT_PRESETS.find((p) => p.id === id) || EFFECT_PRESETS[0];
}

/** Aceita um id de preset, um JSON string ou um objeto parcial e devolve a config completa. */
export function resolveEffects(input: unknown, base: Partial<EffectsConfig> = {}): EffectsConfig {
  let partial: Partial<EffectsConfig> = {};
  if (typeof input === "string") {
    const s = input.trim();
    if (s.startsWith("{")) {
      try {
        partial = JSON.parse(s);
      } catch {
        partial = {};
      }
    } else if (s) {
      partial = getEffectsPreset(s).config;
    }
  } else if (input && typeof input === "object") {
    const o = input as Partial<EffectsConfig> & { preset?: string };
    partial = { ...(o.preset ? getEffectsPreset(o.preset).config : {}), ...o };
    delete (partial as { preset?: string }).preset;
  }
  const cfg: EffectsConfig = { ...DEFAULT_EFFECTS, ...base, ...partial };
  cfg.speed = Math.min(1.1, Math.max(1, Number(cfg.speed) || 1));
  cfg.zoomAmount = Math.min(0.2, Math.max(0, Number(cfg.zoomAmount) || 0));
  cfg.zoomIntervalSec = Math.min(20, Math.max(1, Number(cfg.zoomIntervalSec) || 4));
  cfg.musicVolume = Math.min(1, Math.max(0, Number(cfg.musicVolume) || 0));
  cfg.endCardSeconds = Math.min(6, Math.max(1, Number(cfg.endCardSeconds) || 2.5));
  cfg.handle = cfg.handle ? String(cfg.handle).trim().slice(0, 40) || null : null;
  cfg.endCardText = cfg.endCardText ? String(cfg.endCardText).trim().slice(0, 60) || null : null;
  return cfg;
}

export function hasAnyEffect(e: EffectsConfig) {
  return e.zoom !== "none" || e.progressBar || e.grade !== "none" || e.vignette || !!e.handle || !!e.endCardText || e.mirror || e.speed !== 1 || !!e.musicPath;
}
