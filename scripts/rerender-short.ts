// Re-renderiza um corte fora do app (ex.: apos corrigir o render). Uso:
//   DATABASE_URL=file:<cortix.db> STORAGE_DIR=<storage> npx tsx scripts/rerender-short.ts <shortId> <saida.mp4>
import { PrismaClient } from "@prisma/client";
import { renderClip, probe } from "../src/lib/video/render";
import { resolveEffects } from "../src/lib/effects";
import { getCaptionStyle, type CaptionStyle } from "../src/lib/caption-styles";
const db = new PrismaClient();
async function main() {
  const s = await db.short.findUniqueOrThrow({ where: { id: process.argv[2] }, include: { project: true } });
  const t = JSON.parse(s.captionTemplate || s.project.captionTemplate) as Partial<CaptionStyle> & { id?: string };
  const style = { ...getCaptionStyle(t.id), ...t } as CaptionStyle;
  const effects = resolveEffects(s.effects || s.project.effects || "{}");
  const out = process.argv[3];
  await renderClip({ src: s.project.sourcePath!, start: s.startTime, end: s.endTime, layout: s.layout, style, groups: JSON.parse(s.captions || "[]"), out, width: 1080, crf: 21, preset: "faster", watermark: false, hook: effects.hook ? s.hook || s.title : null, captionsEnabled: !s.project.ignoreCaptions, effects, primaryColor: style.highlightColor });
  const i = await probe(out);
  console.log("ok", out, `${i.width}x${i.height}`, `dur=${i.duration.toFixed(2)}s`, `esperado=${((s.endTime - s.startTime) / effects.speed).toFixed(2)}s`);
  await db.$disconnect();
}
main().catch((e) => { console.error("FALHOU", e.message); process.exit(1); });
