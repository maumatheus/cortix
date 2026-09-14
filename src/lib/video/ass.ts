import type { CaptionStyle } from "../caption-styles";
import type { CaptionGroup } from "./transcript";

function assColor(hex: string, alpha = 0) {
  const h = hex.replace("#", "");
  const r = h.slice(0, 2);
  const g = h.slice(2, 4);
  const b = h.slice(4, 6);
  const a = alpha.toString(16).padStart(2, "0");
  return `&H${a}${b}${g}${r}&`.toUpperCase();
}

function assTime(sec: number) {
  if (sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec - Math.floor(sec)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function esc(t: string) {
  return t.replace(/\\/g, "\\\\").replace(/\{/g, "(").replace(/\}/g, ")");
}

export interface AssOptions {
  style: CaptionStyle;
  groups: CaptionGroup[]; // tempos relativos ao início do clipe
  width: number;
  height: number;
  emojis?: boolean;
  hook?: string | null;
  hookSeconds?: number;
}

/** Gera um arquivo ASS com destaque palavra a palavra. */
export function buildAss(o: AssOptions): string {
  const { style, width, height } = o;
  const scale = width / 1080;
  const fontSize = Math.round(style.fontSize * scale);
  const outline = Math.round((style.strokeWidth / 4) * scale * 10) / 10;
  const shadow = style.shadow ? Math.round(3 * scale) : 0;
  const marginV = Math.round((style.position === "bottom" ? 360 : style.position === "top" ? 260 : 0) * scale);
  const align = style.position === "bottom" ? 2 : style.position === "top" ? 8 : 5;
  const bold = style.fontWeight >= 700 ? -1 : 0;
  const italic = style.italic ? -1 : 0;

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,${style.fontFamily},${fontSize},${assColor(style.fillColor)},${assColor(style.highlightColor)},${assColor(style.strokeColor)},${assColor("#000000", 128)},${bold},${italic},0,0,100,100,0,0,1,${outline},${shadow},${align},${Math.round(60 * scale)},${Math.round(60 * scale)},${marginV},1
Style: Hook,${style.fontFamily},${Math.round(fontSize * 0.9)},${assColor("#FFFFFF")},${assColor("#FFFFFF")},${assColor("#000000")},${assColor("#000000", 60)},-1,0,0,0,100,100,0,0,3,${Math.round(14 * scale)},0,8,${Math.round(80 * scale)},${Math.round(80 * scale)},${Math.round(300 * scale)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const lines: string[] = [];
  const fmt = (t: string) => (style.textCase === "uppercase" ? t.toUpperCase() : t);
  const hi = assColor(style.highlightColor);
  const base = assColor(style.fillColor);

  if (o.hook) {
    const dur = o.hookSeconds ?? 3;
    lines.push(`Dialogue: 1,${assTime(0)},${assTime(dur)},Hook,,0,0,0,,${esc(fmt(o.hook))}`);
  }

  for (const g of o.groups) {
    const ws = g.words;
    if (!ws.length) continue;
    if (style.highlightMode === "none") {
      const text = ws.map((w) => esc(fmt(w.text))).join(" ");
      lines.push(`Dialogue: 0,${assTime(g.start)},${assTime(g.end)},Cap,,0,0,0,,{\\fad(60,40)}${text}`);
      continue;
    }
    for (let i = 0; i < ws.length; i++) {
      const start = i === 0 ? g.start : ws[i].start;
      const end = i === ws.length - 1 ? g.end : ws[i + 1].start;
      if (end - start < 0.03) continue;
      const parts = ws.map((w, k) => {
        const t = esc(fmt(w.text));
        if (k !== i) return `{\\c${base}\\fscx100\\fscy100}${t}`;
        if (style.highlightMode === "box") return `{\\c${hi}\\fscx108\\fscy108}${t}`;
        return `{\\c${hi}\\fscx104\\fscy104}${t}`;
      });
      const anim = i === 0 ? "{\\fad(50,0)}" : "";
      lines.push(`Dialogue: 0,${assTime(start)},${assTime(end)},Cap,,0,0,0,,${anim}${parts.join(" ")}`);
    }
  }
  return header + lines.join("\n") + "\n";
}
