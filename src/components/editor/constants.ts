import type { GuideId } from "./types";

export const CAPTION_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Bowlby+One&family=Bungee&family=Inter:wght@400;700;900&family=Luckiest+Guy&family=Montserrat:wght@400;700;900&family=Oswald:wght@400;700&family=Poppins:wght@400;700;900&family=Titan+One&display=swap";

export const FPS = 30;

export interface VideoFilter {
  id: string;
  name: string;
  category: "retro" | "cinema" | "mood" | "pb" | "cor" | "vibrante";
  css: string;
}

export const FILTER_CATEGORIES: Array<{ id: "all" | VideoFilter["category"]; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "retro", label: "Retro" },
  { id: "cinema", label: "Cinema" },
  { id: "mood", label: "Mood" },
  { id: "pb", label: "P&B" },
  { id: "cor", label: "Cor" },
  { id: "vibrante", label: "Vibrante" },
];

export const VIDEO_FILTERS: VideoFilter[] = [
  { id: "vintage", name: "Vintage", category: "retro", css: "sepia(.45) contrast(.95) brightness(1.05) saturate(.8)" },
  { id: "faded-film", name: "Filme Desbotado", category: "retro", css: "contrast(.85) brightness(1.1) saturate(.7) sepia(.15)" },
  { id: "polaroid", name: "Polaroid", category: "retro", css: "contrast(1.05) brightness(1.08) saturate(.85) sepia(.2) hue-rotate(-8deg)" },
  { id: "vhs", name: "VHS", category: "retro", css: "contrast(1.15) saturate(1.3) blur(.4px) hue-rotate(5deg)" },
  { id: "retro-pop", name: "Retro Pop", category: "retro", css: "contrast(1.2) saturate(1.5) sepia(.1)" },
  { id: "super8", name: "Super 8", category: "retro", css: "sepia(.35) contrast(1.1) brightness(.95) saturate(1.1)" },
  { id: "teal-orange", name: "Teal & Orange", category: "cinema", css: "contrast(1.1) saturate(1.25) hue-rotate(-6deg) sepia(.12)" },
  { id: "blockbuster", name: "Blockbuster", category: "cinema", css: "contrast(1.25) saturate(1.1) brightness(.95)" },
  { id: "noir-moderno", name: "Noir Moderno", category: "cinema", css: "grayscale(.85) contrast(1.35) brightness(.9)" },
  { id: "drama", name: "Drama", category: "cinema", css: "contrast(1.3) brightness(.85) saturate(.9)" },
  { id: "anamorfico", name: "Anamórfico", category: "cinema", css: "contrast(1.15) saturate(.9) hue-rotate(-10deg) brightness(.95)" },
  { id: "sonho", name: "Sonho", category: "mood", css: "brightness(1.1) contrast(.9) saturate(1.1) blur(.3px)" },
  { id: "melancolico", name: "Melancólico", category: "mood", css: "saturate(.6) contrast(.95) brightness(.92) hue-rotate(15deg)" },
  { id: "romantico", name: "Romântico", category: "mood", css: "saturate(1.15) brightness(1.06) sepia(.12) hue-rotate(-12deg)" },
  { id: "frio", name: "Frio", category: "mood", css: "saturate(.9) hue-rotate(25deg) brightness(1.02)" },
  { id: "quente", name: "Quente", category: "mood", css: "saturate(1.2) sepia(.25) brightness(1.04)" },
  { id: "pb-classico", name: "P&B Clássico", category: "pb", css: "grayscale(1) contrast(1.1)" },
  { id: "pb-suave", name: "P&B Suave", category: "pb", css: "grayscale(1) contrast(.9) brightness(1.08)" },
  { id: "pb-alto-contraste", name: "P&B Alto Contraste", category: "pb", css: "grayscale(1) contrast(1.5) brightness(.95)" },
  { id: "pb-prata", name: "Prata", category: "pb", css: "grayscale(1) brightness(1.15) contrast(1.05)" },
  { id: "ciano", name: "Ciano", category: "cor", css: "hue-rotate(160deg) saturate(1.1)" },
  { id: "magenta", name: "Magenta", category: "cor", css: "hue-rotate(-40deg) saturate(1.2)" },
  { id: "esmeralda", name: "Esmeralda", category: "cor", css: "hue-rotate(60deg) saturate(1.15)" },
  { id: "vibrante", name: "Vibrante", category: "vibrante", css: "saturate(1.6) contrast(1.1)" },
  { id: "neon", name: "Neon", category: "vibrante", css: "saturate(2) contrast(1.2) brightness(1.05)" },
  { id: "hdr", name: "HDR Pop", category: "vibrante", css: "contrast(1.3) saturate(1.4) brightness(1.02)" },
];

export const TRANSITIONS = ["Corte seco", "Fade", "Zoom In", "Zoom Out", "Deslizar", "Glitch", "Flash", "Blur"];
export const ANIMATIONS = ["Pop", "Bounce", "Shake", "Fade In", "Typewriter", "Slide Up", "Zoom", "Glow"];

export const MUSIC_TRACKS = [
  { name: "TikTok Phonk", duration: "0:58", mood: "Energético" },
  { name: "Brazilian Phonk Mix", duration: "1:12", mood: "Agressivo" },
  { name: "Lo-fi Chill", duration: "2:04", mood: "Relax" },
  { name: "Trap Motivacional", duration: "1:30", mood: "Motivação" },
  { name: "Funk Viral 2026", duration: "0:47", mood: "Dança" },
  { name: "Cinematic Rise", duration: "1:05", mood: "Épico" },
  { name: "Suspense Dark", duration: "1:20", mood: "Tensão" },
];

export const SOUND_EFFECTS = ["Vine Boom", "Bruh", "Risada", "Aplausos", "Grilo", "Ding", "Erro (Windows)", "Whoosh", "Explosão", "Câmera", "Suspense Sting", "Notificação", "Metal Pipe"];

export const SHAPES: Array<{ kind: "square" | "rounded" | "circle" | "triangle" | "star" | "line" | "arrow" | "heart"; label: string }> = [
  { kind: "square", label: "Quadrado" },
  { kind: "rounded", label: "Arredondado" },
  { kind: "circle", label: "Círculo" },
  { kind: "triangle", label: "Triângulo" },
  { kind: "star", label: "Estrela" },
  { kind: "line", label: "Linha" },
  { kind: "arrow", label: "Seta" },
  { kind: "heart", label: "Coração" },
];

export const SHAPE_COLORS = ["#8b5cf6", "#76FF03", "#FFEB3B", "#FF4081", "#00E5FF", "#FFFFFF", "#FF6D00", "#000000"];

export const ELEMENT_EMOJIS = ["🔥", "😂", "😱", "💰", "❤️", "👀", "💀", "🤯", "✅", "🚫", "👇", "🏆", "⚡", "🎯", "💡", "🙏"];

export const OVERLAYS = [
  { id: "vinheta", label: "Vinheta", css: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.75) 100%)" },
  { id: "grao", label: "Grão", css: "repeating-linear-gradient(0deg, rgba(255,255,255,.03) 0 1px, transparent 1px 3px)" },
  { id: "luz", label: "Luz vazada", css: "linear-gradient(120deg, rgba(255,120,60,.35), transparent 45%, rgba(255,220,120,.25))" },
  { id: "scanlines", label: "Scanlines", css: "repeating-linear-gradient(180deg, rgba(0,0,0,.18) 0 2px, transparent 2px 4px)" },
];

export const VOICES = [
  { name: "Sarah", desc: "Feminina, suave e confiante" },
  { name: "Adam", desc: "Masculina, grave e narrativa" },
  { name: "Liam", desc: "Masculina, jovem e animada" },
  { name: "Lily", desc: "Feminina, calorosa e clara" },
  { name: "Daniel", desc: "Masculina, profissional" },
  { name: "Brian", desc: "Masculina, profunda e calma" },
  { name: "Bella", desc: "Feminina, expressiva" },
  { name: "Charlie", desc: "Masculina, casual e natural" },
];

export const GUIDES: Array<{ id: GuideId; label: string }> = [
  { id: "none", label: "Nenhum" },
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
];

/** Áreas cobertas pela UI de cada plataforma (em % do canvas 9:16). */
export const GUIDE_ZONES: Record<Exclude<GuideId, "none">, Array<{ label: string; x: number; y: number; w: number; h: number }>> = {
  tiktok: [
    { label: "Topo", x: 0, y: 0, w: 100, h: 9 },
    { label: "Ações", x: 84, y: 48, w: 16, h: 32 },
    { label: "Legenda / perfil", x: 0, y: 80, w: 84, h: 20 },
  ],
  instagram: [
    { label: "Topo", x: 0, y: 0, w: 100, h: 12 },
    { label: "Ações", x: 85, y: 55, w: 15, h: 28 },
    { label: "Legenda", x: 0, y: 83, w: 85, h: 17 },
  ],
  youtube: [
    { label: "Topo", x: 0, y: 0, w: 100, h: 10 },
    { label: "Ações", x: 86, y: 52, w: 14, h: 30 },
    { label: "Título / canal", x: 0, y: 84, w: 86, h: 16 },
  ],
};

export const RATIOS = [
  { id: "9:16", label: "9:16", size: "1080 × 1920", enabled: true },
  { id: "16:9", label: "16:9", size: "1920 × 1080", enabled: false },
  { id: "1:1", label: "1:1", size: "1080 × 1080", enabled: false },
  { id: "4:3", label: "4:3", size: "1440 × 1080", enabled: false },
  { id: "4:5", label: "4:5", size: "1080 × 1350", enabled: false },
];

export const SHORTCUTS: Array<[string, string]> = [
  ["Espaço", "Reproduzir / pausar"],
  ["S", "Cortar cena no cursor"],
  ["←  /  →", "Voltar / avançar 1 frame"],
  ["Shift + ←  /  →", "Voltar / avançar 1 segundo"],
  ["Ctrl + Z", "Desfazer"],
  ["Ctrl + Y", "Refazer"],
  ["Ctrl + S", "Salvar"],
  ["Home / End", "Ir ao início / fim do corte"],
  ["Delete", "Remover elemento selecionado"],
];

/** Emojis automáticos por palavra-chave. */
export const EMOJI_KEYWORDS: Array<[RegExp, string]> = [
  [/dinheiro|grana|real|reais|lucro|pagar|caro/i, "💰"],
  [/amor|amo|apaixon|coração/i, "❤️"],
  [/fogo|quente|incr[ií]vel|absurdo/i, "🔥"],
  [/rir|risada|engraçad|kkk|haha/i, "😂"],
  [/medo|assust|susto|terror/i, "😱"],
  [/não|nunca|jamais|proibid/i, "🚫"],
  [/sim|certo|correto|verdade/i, "✅"],
  [/olha|veja|olhe|ver/i, "👀"],
  [/ideia|pensa|sacou|dica/i, "💡"],
  [/ganh|vence|campe|top/i, "🏆"],
  [/rápid|veloc|corre/i, "⚡"],
  [/mund|planeta|país|brasil/i, "🌎"],
];
