import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, readJson, withUser } from "@/lib/api";
import { storageDir } from "@/lib/video/bin";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use o formato #RRGGBB)");

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  handle: z.string().trim().max(60).optional().nullable(),
  primaryColor: color.optional(),
  secondaryColor: color.optional(),
  font: z.string().trim().min(1).max(60).optional(),
  logoUrl: z.string().max(500).optional().nullable(),
});

export const GET = withUser(async ({ params, user }) => {
  const kit = await db.brandKit.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!kit) return fail("Brand kit não encontrado", 404);
  return ok({ kit });
});

export const PATCH = withUser(async ({ req, params, user }) => {
  const body = patchSchema.parse(await readJson(req));
  const kit = await db.brandKit.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!kit) return fail("Brand kit não encontrado", 404);
  const handle = body.handle === undefined ? undefined : body.handle ? (body.handle.startsWith("@") ? body.handle : `@${body.handle}`) : null;
  const updated = await db.brandKit.update({ where: { id: kit.id }, data: { ...body, handle } });
  return ok({ kit: updated });
});

export const DELETE = withUser(async ({ params, user }) => {
  const kit = await db.brandKit.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!kit) return fail("Brand kit não encontrado", 404);
  await db.brandKit.delete({ where: { id: kit.id } });
  // remove o logo salvo no storage, se houver
  if (kit.logoUrl?.startsWith("/api/files/")) {
    try {
      const rel = kit.logoUrl.replace(/^\/api\/files\//, "");
      const abs = path.join(storageDir(), ...rel.split("/"));
      if (abs.startsWith(storageDir("brand", user!.id))) fs.rmSync(abs, { force: true });
    } catch {}
  }
  return ok({ ok: true });
});
