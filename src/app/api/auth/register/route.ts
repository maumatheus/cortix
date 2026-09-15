import { z } from "zod";
import { db } from "@/lib/db";
import { newId, referralCode } from "@/lib/ids";
import { createSession, hashPassword, publicUser } from "@/lib/auth";
import { errorResponse, fail, ok, readJson } from "@/lib/api";
import { licenseEnabled } from "@/lib/license";

const schema = z.object({
  name: z.string().min(2, "Informe seu nome").max(80),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres"),
  ref: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    if (licenseEnabled()) return fail("No Cortix desktop as contas são criadas pelo administrador.", 403);
    const body = schema.parse(await readJson(req));
    const email = body.email.toLowerCase().trim();
    const exists = await db.user.findUnique({ where: { email } });
    if (exists) return fail("Já existe uma conta com este e-mail", 409);
    let referredById: string | undefined;
    if (body.ref) {
      const referrer = await db.user.findUnique({ where: { referralCode: body.ref.toUpperCase() } });
      if (referrer) referredById = referrer.id;
    }
    let code = referralCode();
    while (await db.user.findUnique({ where: { referralCode: code } })) code = referralCode();
    const user = await db.user.create({
      data: { id: newId(), name: body.name.trim(), email, passwordHash: await hashPassword(body.password), referralCode: code, referredById },
    });
    if (referredById) {
      await db.referral.create({ data: { id: newId(), referrerId: referredById, referredId: user.id } });
    }
    await createSession(user.id);
    return ok({ user: publicUser(user) });
  } catch (e) {
    return errorResponse(e);
  }
}
