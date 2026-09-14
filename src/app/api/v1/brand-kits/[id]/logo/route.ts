import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { fail, ok, withUser } from "@/lib/api";
import { newId } from "@/lib/ids";
import { storageDir, storageUrl } from "@/lib/video/bin";

export const runtime = "nodejs";

const MAX_LOGO = 5 * 1024 * 1024;

export const POST = withUser(async ({ req, params, user }) => {
  const kit = await db.brandKit.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!kit) return fail("Brand kit não encontrado", 404);
  const form = await req.formData();
  const file = form.get("file") ?? form.get("logo");
  if (!(file instanceof File)) return fail("Envie a imagem do logo", 422);
  if (!/^image\//.test(file.type) && !/\.(png|jpe?g|webp|svg|gif)$/i.test(file.name)) return fail("Envie uma imagem (PNG, JPG, WEBP ou SVG)", 422);
  if (file.size > MAX_LOGO) return fail("O logo deve ter no máximo 5MB", 422);
  const dir = storageDir("brand", user!.id);
  const ext = (path.extname(file.name) || ".png").toLowerCase();
  const dest = path.join(dir, `${kit.id}-${newId().slice(-6)}${ext}`);
  fs.writeFileSync(dest, Buffer.from(await file.arrayBuffer()));
  // apaga o logo anterior
  if (kit.logoUrl?.startsWith("/api/files/brand/")) {
    try {
      const rel = kit.logoUrl.replace(/^\/api\/files\//, "");
      fs.rmSync(path.join(storageDir(), ...rel.split("/")), { force: true });
    } catch {}
  }
  const logoUrl = storageUrl(dest);
  const updated = await db.brandKit.update({ where: { id: kit.id }, data: { logoUrl } });
  return ok({ kit: updated, logoUrl });
});
