import { z } from "zod";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { ok, readJson, withUser } from "@/lib/api";
import { CAPTION_STYLES, LAYOUTS, CAPTION_FONTS } from "@/lib/caption-styles";
import { ensurePublicTemplates, serializeTemplate } from "@/lib/templates";

const configSchema = z.object({
  styleId: z.string().default("green-fresh"),
  layout: z.string().default("single"),
  font: z.string().default("Montserrat"),
  description: z.string().max(200).optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do template").max(80),
  config: configSchema.default({ styleId: "green-fresh", layout: "single", font: "Montserrat" }),
  isPublic: z.boolean().default(false),
});

export const GET = withUser(async ({ req, user }) => {
  const scope = new URL(req.url).searchParams.get("scope") === "public" ? "public" : "mine";
  if (scope === "public") await ensurePublicTemplates();
  const where = scope === "public" ? { isPublic: true } : { userId: user!.id };
  const items = await db.template.findMany({ where, orderBy: scope === "public" ? { uses: "desc" } : { createdAt: "desc" }, include: { user: { select: { name: true } } } });
  return ok({ data: items.map((t) => serializeTemplate(t, user!.id)), total: items.length, scope });
});

export const POST = withUser(async ({ req, user }) => {
  const body = createSchema.parse(await readJson(req));
  const cfg = { ...body.config };
  if (!CAPTION_STYLES.some((s) => s.id === cfg.styleId)) cfg.styleId = "green-fresh";
  if (!LAYOUTS.some((l) => l.id === cfg.layout)) cfg.layout = "single";
  if (!CAPTION_FONTS.includes(cfg.font)) cfg.font = "Montserrat";
  const t = await db.template.create({ data: { id: newId(), userId: user!.id, name: body.name, config: JSON.stringify(cfg), isPublic: body.isPublic } });
  return ok({ template: serializeTemplate(t, user!.id) }, { status: 201 });
});
