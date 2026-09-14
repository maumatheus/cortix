import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { fail, ok, withUser } from "@/lib/api";
import { newId } from "@/lib/ids";
import { storageDir, storageUrl } from "@/lib/video/bin";

export const runtime = "nodejs";

const MAX_SIZE = 500 * 1024 * 1024;

/** Normaliza o caminho de pasta: "a/b" sem barras nas pontas. */
function normalizeFolder(raw: string | null | undefined) {
  return (raw || "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("/");
}

export const GET = withUser(async ({ req, user }) => {
  const u = new URL(req.url);
  const scope = u.searchParams.get("scope") === "public" ? "public" : "mine";
  const folder = normalizeFolder(u.searchParams.get("folder"));
  const where = scope === "public" ? { isPublic: true, mime: { not: "folder" } } : { userId: user!.id, folder };
  const items = await db.libraryFile.findMany({
    where,
    orderBy: [{ mime: "asc" }, { createdAt: "desc" }],
    include: { user: { select: { name: true } } },
  });
  // pastas primeiro
  const sorted = [...items].sort((a, b) => Number(b.mime === "folder") - Number(a.mime === "folder"));
  const usage = await db.libraryFile.aggregate({ where: { userId: user!.id }, _sum: { size: true }, _count: true });
  return ok({
    data: sorted.map((f) => ({ ...f, isMine: f.userId === user!.id, author: f.user.name, user: undefined })),
    folder,
    scope,
    usage: { bytes: usage._sum.size || 0, count: usage._count },
  });
});

export const POST = withUser(async ({ req, user }) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return fail("Arquivo não enviado", 422);
  if (file.size > MAX_SIZE) return fail("O arquivo deve ter no máximo 500MB", 422);
  const folder = normalizeFolder(String(form.get("folder") || ""));
  const isPublic = String(form.get("isPublic") || "") === "true";
  const id = newId();
  const dir = storageDir("library", user!.id);
  const ext = path.extname(file.name).toLowerCase().slice(0, 12);
  const dest = path.join(dir, `${id}${ext}`);
  fs.writeFileSync(dest, Buffer.from(await file.arrayBuffer()));
  const item = await db.libraryFile.create({
    data: {
      id,
      userId: user!.id,
      name: file.name.slice(0, 200),
      folder,
      path: dest,
      url: storageUrl(dest),
      size: file.size,
      mime: file.type || "application/octet-stream",
      isPublic,
    },
  });
  return ok({ file: item }, { status: 201 });
});
