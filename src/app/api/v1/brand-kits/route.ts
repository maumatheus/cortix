import { z } from "zod";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { ok, readJson, withUser } from "@/lib/api";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use o formato #RRGGBB)");

const createSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do brand kit").max(80),
  handle: z.string().trim().max(60).optional().nullable(),
  primaryColor: color.default("#7c3aed"),
  secondaryColor: color.default("#76FF03"),
  font: z.string().trim().min(1).max(60).default("Montserrat"),
  logoUrl: z.string().max(500).optional().nullable(),
});

export const GET = withUser(async ({ user }) => {
  const kits = await db.brandKit.findMany({ where: { userId: user!.id }, orderBy: { createdAt: "desc" } });
  return ok({ data: kits, total: kits.length });
});

export const POST = withUser(async ({ req, user }) => {
  const body = createSchema.parse(await readJson(req));
  const handle = body.handle ? (body.handle.startsWith("@") ? body.handle : `@${body.handle}`) : null;
  const kit = await db.brandKit.create({
    data: {
      id: newId(),
      userId: user!.id,
      name: body.name,
      handle,
      primaryColor: body.primaryColor,
      secondaryColor: body.secondaryColor,
      font: body.font,
      logoUrl: body.logoUrl ?? null,
    },
  });
  return ok({ kit }, { status: 201 });
});
