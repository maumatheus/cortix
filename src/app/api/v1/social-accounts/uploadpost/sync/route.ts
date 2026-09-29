import { ok, withUser } from "@/lib/api";
import { uploadPostKey } from "@/lib/social/config";
import { syncUploadPostAccounts } from "@/lib/social/uploadpost";

/** Espelha as contas conectadas no Upload-Post como contas de publicação do Cortix. */
export const POST = withUser(async ({ user }) => {
  if (!uploadPostKey()) return ok({ data: [] });
  return ok({ data: await syncUploadPostAccounts(user!.id) });
});
