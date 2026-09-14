import { getCurrentUser, publicUser } from "@/lib/auth";
import { fail, ok } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("Não autenticado", 401);
  return ok({ user: publicUser(user) });
}
