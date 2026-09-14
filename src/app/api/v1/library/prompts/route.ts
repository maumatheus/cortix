import { z } from "zod";
import { db } from "@/lib/db";
import { ok, readJson, withUser } from "@/lib/api";
import { newId } from "@/lib/ids";

const createSchema = z.object({
  title: z.string().trim().min(1, "Informe um título").max(120),
  content: z.string().trim().min(1, "Escreva o prompt").max(8000),
  isPublic: z.boolean().default(false),
});

export const GET = withUser(async ({ req, user }) => {
  const scope = new URL(req.url).searchParams.get("scope") === "public" ? "public" : "mine";
  const where = scope === "public" ? { isPublic: true } : { userId: user!.id };
  const items = await db.libraryPrompt.findMany({ where, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } });
  return ok({ data: items.map((p) => ({ ...p, isMine: p.userId === user!.id, author: p.user.name, user: undefined })), scope });
});

export const POST = withUser(async ({ req, user }) => {
  const body = createSchema.parse(await readJson(req));
  const prompt = await db.libraryPrompt.create({ data: { id: newId(), userId: user!.id, ...body } });
  return ok({ prompt }, { status: 201 });
});
