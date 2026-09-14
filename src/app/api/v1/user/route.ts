import { z } from "zod";
import { db } from "@/lib/db";
import { publicUser } from "@/lib/auth";
import { ok, readJson, withUser } from "@/lib/api";

const schema = z.object({
  name: z.string().min(2).max(80).optional(),
  pixKey: z.string().max(120).nullable().optional(),
  theme: z.enum(["dark", "light"]).optional(),
  locale: z.enum(["pt-BR", "en"]).optional(),
  referralCode: z
    .string()
    .regex(/^[A-Z0-9]{4,12}$/i, "Use de 4 a 12 letras ou números")
    .optional(),
});

export const GET = withUser(async ({ user }) => ok({ user: publicUser(user!) }));

export const PATCH = withUser(async ({ req, user }) => {
  const body = schema.parse(await readJson(req));
  if (body.referralCode) {
    const code = body.referralCode.toUpperCase();
    const taken = await db.user.findUnique({ where: { referralCode: code } });
    if (taken && taken.id !== user!.id) {
      const err = new Error("Este código já está em uso") as Error & { status: number };
      err.status = 409;
      throw err;
    }
    body.referralCode = code;
  }
  const updated = await db.user.update({ where: { id: user!.id }, data: body });
  return ok({ user: publicUser(updated) });
});
