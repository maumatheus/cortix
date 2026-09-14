import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, publicUser, verifyPassword } from "@/lib/auth";
import { errorResponse, fail, ok, readJson } from "@/lib/api";

const schema = z.object({ email: z.string().min(1, "Informe o usuário ou e-mail"), password: z.string().min(1, "Informe a senha") });

export async function POST(req: Request) {
  try {
    const body = schema.parse(await readJson(req));
    const user = await db.user.findUnique({ where: { email: body.email.toLowerCase().trim() } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) return fail("Usuário ou senha incorretos", 401);
    await createSession(user.id);
    return ok({ user: publicUser(user) });
  } catch (e) {
    return errorResponse(e);
  }
}
