import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, readJson, withUser } from "@/lib/api";
import { groupWords, wordsInRange, type Word } from "@/lib/video/transcript";
import { getCaptionStyle } from "@/lib/caption-styles";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  layout: z.string().optional(),
  startTime: z.number().min(0).optional(),
  endTime: z.number().min(0).optional(),
  captionTemplate: z.record(z.string(), z.unknown()).nullable().optional(),
  captions: z.array(z.object({ start: z.number(), end: z.number(), words: z.array(z.object({ text: z.string(), start: z.number(), end: z.number() })) })).optional(),
  hook: z.string().max(160).nullable().optional(),
});

async function ownShort(id: string, userId: string) {
  return db.short.findFirst({ where: { id, project: { userId } }, include: { project: true } });
}

export const GET = withUser(async ({ params, user }) => {
  const short = await ownShort(params.id, user!.id);
  if (!short) return fail("Corte não encontrado", 404);
  const words: Word[] = short.project.transcript ? JSON.parse(short.project.transcript) : [];
  const renders = await db.render.findMany({ where: { shortId: short.id }, orderBy: { createdAt: "desc" }, take: 5 });
  return ok({
    short: { ...short, captions: JSON.parse(short.captions || "[]"), captionTemplate: short.captionTemplate ? JSON.parse(short.captionTemplate) : null, project: { ...short.project, transcript: undefined, captionTemplate: JSON.parse(short.project.captionTemplate || "{}") } },
    words: wordsInRange(words, Math.max(0, short.startTime - 120), short.endTime + 120),
    renders,
  });
});

export const PATCH = withUser(async ({ req, params, user }) => {
  const body = patchSchema.parse(await readJson(req));
  const short = await ownShort(params.id, user!.id);
  if (!short) return fail("Corte não encontrado", 404);
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.layout !== undefined) data.layout = body.layout;
  if (body.hook !== undefined) data.hook = body.hook;
  if (body.captionTemplate !== undefined) data.captionTemplate = body.captionTemplate ? JSON.stringify(body.captionTemplate) : null;
  const start = body.startTime ?? short.startTime;
  const end = body.endTime ?? short.endTime;
  if (end - start < 3) return fail("O corte precisa ter pelo menos 3 segundos", 422);
  const timeChanged = start !== short.startTime || end !== short.endTime;
  if (timeChanged) {
    data.startTime = start;
    data.endTime = end;
  }
  if (body.captions) {
    data.captions = JSON.stringify(body.captions);
  } else if (timeChanged || body.captionTemplate !== undefined) {
    // reagrupa legendas a partir da transcrição
    const words: Word[] = short.project.transcript ? JSON.parse(short.project.transcript) : [];
    const styleRaw = body.captionTemplate ?? (short.captionTemplate ? JSON.parse(short.captionTemplate) : JSON.parse(short.project.captionTemplate || "{}"));
    const style = { ...getCaptionStyle((styleRaw as { id?: string })?.id), ...(styleRaw as object) } as ReturnType<typeof getCaptionStyle>;
    data.captions = JSON.stringify(groupWords(wordsInRange(words, start, end), style.wordsPerGroup, style.maxChars));
  }
  // qualquer edição invalida o render anterior
  if (Object.keys(data).length && short.status === "rendered") data.status = "ready";
  const updated = await db.short.update({ where: { id: short.id }, data });
  return ok({ short: { ...updated, captions: JSON.parse(updated.captions || "[]") } });
});

export const DELETE = withUser(async ({ params, user }) => {
  const short = await ownShort(params.id, user!.id);
  if (!short) return fail("Corte não encontrado", 404);
  await db.short.delete({ where: { id: short.id } });
  return ok({ ok: true });
});
