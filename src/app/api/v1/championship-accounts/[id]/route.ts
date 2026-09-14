import { db } from "@/lib/db";
import { fail, ok, withUser } from "@/lib/api";

export const DELETE = withUser(async ({ params, user }) => {
  const account = await db.socialAccount.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!account) return fail("Conta não encontrada", 404);
  await db.socialAccount.delete({ where: { id: account.id } });
  return ok({ ok: true });
});
