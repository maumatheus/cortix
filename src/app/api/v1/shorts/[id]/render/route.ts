import { z } from "zod";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { isSubscriber } from "@/lib/auth";
import { fail, ok, readJson, withUser } from "@/lib/api";
import { enqueue } from "@/lib/video/queue";
import { resolveEffects } from "@/lib/effects";

const schema = z.object({
  resolution: z.enum(["1080x1920", "720x1280"]).default("1080x1920"),
  /** Override de efeitos só para este corte: id de preset ou objeto parcial de EffectsConfig */
  effects: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
});

export const POST = withUser(async ({ req, params, user }) => {
  const body = schema.parse(await readJson(req));
  const short = await db.short.findFirst({ where: { id: params.id, project: { userId: user!.id } }, include: { project: true } });
  if (!short) return fail("Corte não encontrado", 404);
  if (short.status === "rendering") {
    const active = await db.render.findFirst({ where: { shortId: short.id, status: { in: ["queued", "processing"] } }, orderBy: { createdAt: "desc" } });
    if (active) return ok({ render: active, reused: true });
  }
  // marca d'água só some para assinantes ou projetos pagos com créditos
  const watermark = !(isSubscriber(user!) || !short.project.isFree);
  const render = await db.render.create({
    data: { id: newId(), shortId: short.id, userId: user!.id, resolution: body.resolution, watermark, status: "queued" },
  });
  const effectsOverride = body.effects !== undefined ? JSON.stringify(resolveEffects(body.effects, resolveEffects(short.project.effects))) : undefined;
  await db.short.update({ where: { id: short.id }, data: { status: "rendering", renderProgress: 0, watermark, ...(effectsOverride !== undefined ? { effects: effectsOverride } : {}) } });
  enqueue({ kind: "render", id: render.id });
  return ok({ render });
});

export const GET = withUser(async ({ params, user }) => {
  const render = await db.render.findFirst({ where: { shortId: params.id, userId: user!.id }, orderBy: { createdAt: "desc" } });
  return ok({ render });
});
