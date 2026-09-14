import type { CaptionStyle } from "@/lib/caption-styles";
import type { CaptionGroup, Word } from "@/lib/video/transcript";

/** CaptionStyle + chaves extras que o editor persiste dentro de captionTemplate. */
export interface EditorStyle extends CaptionStyle {
  /** motion por cena (índice da cena → ligado) */
  faceMotion?: Record<string, boolean>;
  /** id do filtro CSS aplicado ao vídeo */
  filter?: string | null;
  /** emojis automáticos nas legendas */
  emojis?: boolean;
}

export interface ShapeOverlay {
  id: string;
  kind: "square" | "rounded" | "circle" | "triangle" | "star" | "line" | "arrow" | "heart" | "emoji" | "overlay";
  label: string;
  color: string;
  /** posição/tamanho em % do canvas */
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
}

/** Estado editável (entra no histórico de desfazer/refazer). */
export interface EditorState {
  title: string;
  layout: string;
  startTime: number;
  endTime: number;
  style: EditorStyle;
  captions: CaptionGroup[];
  hook: string | null;
  shapes: ShapeOverlay[];
}

export interface ShortRecord {
  id: string;
  projectId: string;
  title: string;
  reason: string | null;
  hook: string | null;
  score: number;
  startTime: number;
  endTime: number;
  status: string;
  renderProgress: number;
  layout: string;
  captionTemplate: Record<string, unknown> | null;
  captions: CaptionGroup[];
  thumbnailUrl: string | null;
  previewUrl: string | null;
  renderUrl: string | null;
  watermark: boolean;
  project: {
    id: string;
    title: string;
    sourcePath: string | null;
    durationSec: number;
    captionTemplate: Record<string, unknown>;
    ignoreCaptions: boolean;
    autoCta: boolean;
    isFree: boolean;
    thumbnailUrl: string | null;
  };
}

export interface RenderRecord {
  id: string;
  status: string;
  progress: number;
  url: string | null;
  resolution: string;
  createdAt: string;
}

export interface ShortResponse {
  short: ShortRecord;
  words: Word[];
  renders: RenderRecord[];
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

export type PanelId = "templates" | "texto" | "brand" | "arquivos" | "audio" | "elementos" | "efeitos" | "ia";

export type GuideId = "none" | "tiktok" | "instagram" | "youtube";
