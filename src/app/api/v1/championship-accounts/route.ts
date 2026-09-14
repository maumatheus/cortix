import { z } from "zod";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { fail, ok, readJson, withUser } from "@/lib/api";
import { PLATFORM_VALUES } from "@/lib/championships";

const schema = z.object({
  platform: z.enum(PLATFORM_VALUES, { message: "Escolha TikTok, Instagram ou YouTube" }),
  handle: z
    .string()
    .trim()
    .transform((h) => h.replace(/^@+/, "").replace(/\s+/g, ""))
    .pipe(z.string().min(2, "Informe o @ da conta").max(60, "@ muito longo")),
  purpose: z.enum(["publish", "championship"]).default("championship"),
});

/** Contas sociais do usuário (padrão: purpose=championship). */
export const GET = withUser(async ({ req, user }) => {
  const u = new URL(req.url);
  const purpose = u.searchParams.get("purpose") || "championship";
  const data = await db.socialAccount.findMany({
    where: { userId: user!.id, ...(purpose === "all" ? {} : { purpose }) },
    orderBy: { createdAt: "asc" },
  });
  return ok({ data });
});

export const POST = withUser(async ({ req, user }) => {
  const body = schema.parse(await readJson(req));
  const dup = await db.socialAccount.findFirst({ where: { userId: user!.id, platform: body.platform, purpose: body.purpose, handle: body.handle } });
  if (dup) return fail("Essa conta já está conectada", 409);
  const account = await db.socialAccount.create({ data: { id: newId(), userId: user!.id, ...body } });
  return ok({ account }, { status: 201 });
});
