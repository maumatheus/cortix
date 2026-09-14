import fs from "node:fs";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, readJson, withUser } from "@/lib/api";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  folder: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
});

function norm(raw: string) {
  return raw
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("/");
}

export const PATCH = withUser(async ({ req, params, user }) => {
  const body = patchSchema.parse(await readJson(req));
  const f = await db.libraryFile.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!f) return fail("Arquivo não encontrado", 404);
  if (f.mime === "folder" && body.isPublic) return fail("Pastas não podem ser públicas", 400);
  const data: { name?: string; folder?: string; isPublic?: boolean } = { name: body.name, isPublic: body.isPublic };
  if (body.folder !== undefined) data.folder = norm(body.folder);
  const updated = await db.libraryFile.update({ where: { id: f.id }, data });
  // renomear pasta move os arquivos filhos
  if (f.mime === "folder" && body.name && body.name !== f.name) {
    const oldPath = f.folder ? `${f.folder}/${f.name}` : f.name;
    const newPath = f.folder ? `${f.folder}/${body.name}` : body.name;
    const children = await db.libraryFile.findMany({ where: { userId: user!.id, OR: [{ folder: oldPath }, { folder: { startsWith: oldPath + "/" } }] } });
    for (const c of children) {
      await db.libraryFile.update({ where: { id: c.id }, data: { folder: newPath + c.folder.slice(oldPath.length) } });
    }
  }
  return ok({ file: updated });
});

export const DELETE = withUser(async ({ params, user }) => {
  const f = await db.libraryFile.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!f) return fail("Arquivo não encontrado", 404);
  if (f.mime === "folder") {
    const full = f.folder ? `${f.folder}/${f.name}` : f.name;
    const children = await db.libraryFile.findMany({ where: { userId: user!.id, OR: [{ folder: full }, { folder: { startsWith: full + "/" } }] } });
    for (const c of children) {
      if (c.path) {
        try {
          fs.rmSync(c.path, { force: true });
        } catch {}
      }
    }
    await db.libraryFile.deleteMany({ where: { id: { in: children.map((c) => c.id) } } });
  } else if (f.path) {
    try {
      fs.rmSync(f.path, { force: true });
    } catch {}
  }
  await db.libraryFile.delete({ where: { id: f.id } });
  return ok({ ok: true });
});
