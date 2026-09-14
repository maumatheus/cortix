import { db } from "@/lib/db";
import { ok, withUser } from "@/lib/api";

export const GET = withUser(async ({ req, user }) => {
  const u = new URL(req.url);
  const page = Math.max(1, Number(u.searchParams.get("page")) || 1);
  const limit = Math.min(100, Number(u.searchParams.get("limit")) || 20);
  const type = u.searchParams.get("type");
  const where = { userId: user!.id, ...(type ? { type } : {}) };
  const [total, data] = await Promise.all([
    db.creditTransaction.count({ where }),
    db.creditTransaction.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
  ]);
  return ok({ data, page, limit, total, lastPage: Math.max(1, Math.ceil(total / limit)), balance: user!.credits });
});
