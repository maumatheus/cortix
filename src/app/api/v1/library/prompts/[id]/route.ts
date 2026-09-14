import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, readJson, withUser } from "@/lib/api";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  content: z.string().trim().min(1).max(8000).optional(),
  isPublic: z.boolean().optional(),
});

export const PATCH = withUser(async ({ req, params, user }) => {
  const body = patchSchema.parse(await readJson(req));
  const p = await db.libraryPrompt.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!p) return fail("Prompt não encontrado", 404);
  const prompt = await db.libraryPrompt.update({ where: { id: p.id }, data: body });
  return ok({ prompt });
});

export const DELETE = withUser(async ({ params, user }) => {
  const p = await db.libraryPrompt.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!p) return fail("Prompt não encontrado", 404);
  await db.libraryPrompt.delete({ where: { id: p.id } });
  return ok({ ok: true });
});
