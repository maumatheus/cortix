import { z } from "zod";
import { db } from "@/lib/db";
import { ok, readJson, withUser } from "@/lib/api";
import { newId } from "@/lib/ids";

const createSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do monitoramento").max(80),
  channelUrl: z
    .string()
    .trim()
    .min(1, "Informe a URL do canal")
    .refine((v) => /^https?:\/\//i.test(v), "URL inválida"),
  prompt: z.string().trim().max(2000).default(""),
  minScore: z.number().int().min(1).max(10).default(7),
});

export const GET = withUser(async ({ req, user }) => {
  const scope = new URL(req.url).searchParams.get("scope") === "public" ? "public" : "mine";
  const monitors = await db.liveMonitor.findMany({
    where: scope === "public" ? { status: "live" } : { userId: user!.id },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
  });
  const mine = await db.liveMonitor.findMany({ where: { userId: user!.id }, select: { status: true, clipsCount: true, createdAt: true } });
  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const stats = {
    liveNow: mine.filter((m) => m.status === "live").length,
    channels: mine.length,
    clipsTotal: mine.reduce((a, m) => a + m.clipsCount, 0),
    clipsLast7d: mine.filter((m) => m.createdAt >= weekAgo).reduce((a, m) => a + m.clipsCount, 0),
  };
  return ok({ data: monitors.map((m) => ({ ...m, isMine: m.userId === user!.id, author: m.user.name, user: undefined })), stats, scope, credits: user!.credits });
});

export const POST = withUser(async ({ req, user }) => {
  const body = createSchema.parse(await readJson(req));
  const monitor = await db.liveMonitor.create({ data: { id: newId(), userId: user!.id, ...body, status: "idle" } });
  return ok({ monitor }, { status: 201 });
});
