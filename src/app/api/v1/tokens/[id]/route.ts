import { db } from "@/lib/db";
import { fail, ok, withUser } from "@/lib/api";

export const DELETE = withUser(async ({ params, user }) => {
  const t = await db.apiToken.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!t) return fail("Token não encontrado", 404);
  await db.apiToken.delete({ where: { id: t.id } });
  return ok({ ok: true });
});
