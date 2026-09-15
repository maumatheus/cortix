export interface CaptionStyle {
  id: string;
  name: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number; // em px na composição 1080x1920
  textCase: "uppercase" | "none";
  fillColor: string;
  highlightColor: string;
  highlightMode: "word" | "none" | "box";
  strokeColor: string;
  strokeWidth: number;
  shadow: boolean;
  italic?: boolean;
  background?: string | null;
  wordsPerGroup: number;
  maxChars: number;
  position: "bottom" | "center" | "top";
  /** cor secundária usada na prévia (segunda palavra) */
  accent2?: string;
}

const base = {
  fontFamily: "Montserrat",
  fontWeight: 900,
  fontSize: 72,
  textCase: "uppercase" as const,
  strokeColor: "#000000",
  strokeWidth: 10,
  shadow: true,
  wordsPerGroup: 4,
  maxChars: 26,
  position: "center" as const,
  highlightMode: "word" as const,
};

export const CAPTION_STYLES: CaptionStyle[] = [
  { ...base, id: "none", name: "Sem legenda", fillColor: "#FFFFFF", highlightColor: "#FFFFFF", highlightMode: "none" },
  { ...base, id: "green-fresh", name: "Verde Fresco", fillColor: "#FFFFFF", highlightColor: "#76FF03" },
  { ...base, id: "rainbow-vfx", name: "Rainbow VFX", fillColor: "#FFD600", highlightColor: "#00E5FF", accent2: "#FF4081" },
  { ...base, id: "punch-flow", name: "Punch Flow", fontFamily: "Anton", fontWeight: 400, fillColor: "#FFFFFF", highlightColor: "#FFEB3B", highlightMode: "box" },
  { ...base, id: "editorial-contrast", name: "Editorial Contrast", fontFamily: "Montserrat", fillColor: "#FFFFFF", highlightColor: "#FF9800", strokeWidth: 6 },
  { ...base, id: "condensed-signature", name: "Condensed Signature", fontFamily: "Bebas Neue", fontWeight: 400, fontSize: 84, fillColor: "#FFFFFF", highlightColor: "#FFD54F" },
  { ...base, id: "vanishing-point", name: "Vanishing Point", fontFamily: "Montserrat", fillColor: "#FFFFFF", highlightColor: "#B388FF", strokeWidth: 8 },
  { ...base, id: "red-impact", name: "Impacto Vermelho", fontFamily: "Anton", fontWeight: 400, fontSize: 80, fillColor: "#FFFFFF", highlightColor: "#FF1744" },
  { ...base, id: "yellow-pop", name: "Yellow Pop", fillColor: "#FFEB3B", highlightColor: "#FFFFFF" },
  { ...base, id: "reaction", name: "Reaction", fontFamily: "Luckiest Guy", fontWeight: 400, fontSize: 78, fillColor: "#FFFFFF", highlightColor: "#00E676" },
  { ...base, id: "karaoke-orange", name: "Karaokê Laranja", fillColor: "#FFFFFF", highlightColor: "#FF6D00", wordsPerGroup: 6, maxChars: 34, position: "bottom" },
  { ...base, id: "karaoke-pink", name: "Karaokê Rosa", fillColor: "#FFFFFF", highlightColor: "#FF4081", wordsPerGroup: 6, maxChars: 34, position: "bottom" },
  { ...base, id: "cartoon", name: "Cartoon", fontFamily: "Luckiest Guy", fontWeight: 400, fillColor: "#FFD600", highlightColor: "#FF3D00", strokeWidth: 12 },
  { ...base, id: "titan", name: "Titan", fontFamily: "Titan One", fontWeight: 400, fontSize: 76, fillColor: "#FFFFFF", highlightColor: "#40C4FF" },
  { ...base, id: "bowlby", name: "Bowlby", fontFamily: "Bowlby One", fontWeight: 400, fontSize: 70, fillColor: "#FFFFFF", highlightColor: "#FFAB00" },
  { ...base, id: "golden-layers", name: "Golden Layers", fillColor: "#FFC107", highlightColor: "#FFFFFF", strokeWidth: 8 },
  { ...base, id: "lime-stack", name: "Lime Stack", fontFamily: "Anton", fontWeight: 400, fillColor: "#FFFFFF", highlightColor: "#C6FF00", wordsPerGroup: 3, maxChars: 18 },
  { ...base, id: "lime-impact", name: "Lime Impact", fontFamily: "Bungee", fontWeight: 400, fontSize: 68, fillColor: "#C6FF00", highlightColor: "#FFFFFF" },
  { ...base, id: "lime-story", name: "Lime Story", fillColor: "#FFFFFF", highlightColor: "#AEEA00", highlightMode: "box" },
  { ...base, id: "neon-statement", name: "Neon Statement", fillColor: "#E040FB", highlightColor: "#18FFFF", strokeWidth: 4 },
  { ...base, id: "echo-glide", name: "Echo Glide", fillColor: "#FFFFFF", highlightColor: "#FFFFFF", textCase: "none", fontWeight: 700, strokeWidth: 4, wordsPerGroup: 6, maxChars: 36 },
  { ...base, id: "monument-stack", name: "Monument Stack", fontFamily: "Anton", fontWeight: 400, fontSize: 96, fillColor: "#FFFFFF", highlightColor: "#FFFFFF", wordsPerGroup: 3, maxChars: 16, highlightMode: "none" },
  { ...base, id: "editorial-rise", name: "Editorial Rise", fontFamily: "Anton", fontWeight: 400, fontSize: 88, fillColor: "#FFFFFF", highlightColor: "#FFFFFF", wordsPerGroup: 3, maxChars: 16, highlightMode: "none" },
];

export const CAPTION_FONTS = ["Montserrat", "Anton", "Bebas Neue", "Luckiest Guy", "Titan One", "Bungee", "Bowlby One", "Inter", "Poppins", "Oswald"];

export function getCaptionStyle(id: string | null | undefined): CaptionStyle {
  return CAPTION_STYLES.find((s) => s.id === id) || CAPTION_STYLES[1];
}

export const CLIP_DURATIONS = [
  { id: "auto", label: "Automático", min: 20, max: 90 },
  { id: "30", label: "30 seg", min: 20, max: 40 },
  { id: "60", label: "1 min", min: 45, max: 75 },
  { id: "tiktok", label: "TikTok Rewards (61s+)", min: 62, max: 95, strictMin: true },
  { id: "90", label: "1:30 min", min: 75, max: 105 },
  { id: "180", label: "3 min", min: 150, max: 210 },
  { id: "300", label: "5 min", min: 240, max: 360, pro: true },
  { id: "900", label: "15 min", min: 600, max: 900, pro: true },
];

export const LAYOUTS = [
  { id: "single", name: "Single", description: "Recorte central em tela cheia", group: "sugeridos" },
  { id: "center", name: "Center", description: "Vídeo inteiro no centro com fundo desfocado", group: "sugeridos" },
  { id: "split", name: "Split", description: "Duas metades empilhadas", group: "sugeridos" },
  { id: "react", name: "React", description: "Vídeo no topo, câmera embaixo", group: "sugeridos" },
  { id: "split-vertical", name: "Split Vertical", description: "Lado a lado", group: "avancados" },
  { id: "tri-split", name: "Tri-Split", description: "Três faixas", group: "avancados" },
];
