import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, readJson, withUser } from "@/lib/api";
import { newId } from "@/lib/ids";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe o nome da pasta")
    .max(80)
    .refine((v) => !v.includes("/"), "O nome da pasta não pode conter /"),
  folder: z.string().max(500).default(""),
});

/** Uma pasta é apenas um LibraryFile com mime "folder". */
export const POST = withUser(async ({ req, user }) => {
  const body = schema.parse(await readJson(req));
  const parent = body.folder
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("/");
  const dup = await db.libraryFile.findFirst({ where: { userId: user!.id, folder: parent, mime: "folder", name: body.name } });
  if (dup) return fail("Já existe uma pasta com esse nome aqui", 409);
  const folder = await db.libraryFile.create({
    data: { id: newId(), userId: user!.id, name: body.name, folder: parent, path: "", url: "", size: 0, mime: "folder", isPublic: false },
  });
  return ok({ folder }, { status: 201 });
});
