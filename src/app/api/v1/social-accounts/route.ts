import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, readJson, withUser } from "@/lib/api";
import { newId } from "@/lib/ids";
import { isSubscriber } from "@/lib/auth";
import { getPlan } from "@/lib/plans";

const createSchema = z.object({
  platform: z.enum(["tiktok", "instagram", "youtube"]),
  handle: z.string().trim().min(1, "Informe o @ da conta").max(80),
  purpose: z.enum(["publish", "championship"]).default("publish"),
});

export const GET = withUser(async ({ req, user }) => {
  const purpose = new URL(req.url).searchParams.get("purpose");
  const where = { userId: user!.id, ...(purpose === "publish" || purpose === "championship" ? { purpose } : {}) };
  const accounts = await db.socialAccount.findMany({ where, orderBy: { createdAt: "asc" }, include: { _count: { select: { scheduledPosts: true } } } });
  const plan = getPlan(user!.plan);
  const limit = isSubscriber(user!) && plan ? plan.socials : 0;
  return ok({
    data: accounts.map((a) => ({ ...a, postsCount: a._count.scheduledPosts, _count: undefined })),
    limit,
    plan: plan?.name ?? null,
    isSubscriber: isSubscriber(user!),
  });
});

export const POST = withUser(async ({ req, user }) => {
  const body = createSchema.parse(await readJson(req));
  const handle = body.handle.startsWith("@") ? body.handle : `@${body.handle}`;
  if (body.purpose === "publish") {
    if (!isSubscriber(user!)) return fail("Conectar redes para publicação é exclusivo dos assinantes. Assine um plano pra liberar.", 403);
    const plan = getPlan(user!.plan);
    const limit = plan?.socials ?? 0;
    const count = await db.socialAccount.count({ where: { userId: user!.id, purpose: "publish" } });
    if (count >= limit) return fail(`Seu plano ${plan?.name ?? ""} permite até ${limit} ${limit === 1 ? "conta conectada" : "contas conectadas"}. Faça upgrade pra conectar mais.`, 403);
  }
  const dup = await db.socialAccount.findFirst({ where: { userId: user!.id, platform: body.platform, handle, purpose: body.purpose } });
  if (dup) return fail("Essa conta já está conectada", 409);
  const account = await db.socialAccount.create({ data: { id: newId(), userId: user!.id, platform: body.platform, handle, purpose: body.purpose } });
  return ok({ account, simulated: true, message: "Conexão simulada: o OAuth real das redes não está disponível nesta versão." }, { status: 201 });
});
