import { z } from "zod";
import { db } from "@/lib/db";
import { ok, readJson, withUser } from "@/lib/api";
import { newId } from "@/lib/ids";
import { publishDuePosts } from "@/lib/publisher";
import { launcherInclude, serializeLauncher } from "@/lib/launchers";

const createSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do launcher").max(80),
  platforms: z.array(z.enum(["tiktok", "instagram", "youtube"])).min(1, "Escolha pelo menos uma rede"),
  times: z.array(z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido (use HH:MM)")).min(1, "Adicione pelo menos um horário").max(12),
});

export const GET = withUser(async ({ user }) => {
  await publishDuePosts(user!.id);
  const launchers = await db.launcher.findMany({ where: { userId: user!.id }, orderBy: { createdAt: "desc" }, include: launcherInclude });
  return ok({ data: launchers.map(serializeLauncher), total: launchers.length });
});

export const POST = withUser(async ({ req, user }) => {
  const body = createSchema.parse(await readJson(req));
  const times = [...new Set(body.times)].sort();
  const launcher = await db.launcher.create({
    data: { id: newId(), userId: user!.id, name: body.name, platforms: JSON.stringify([...new Set(body.platforms)]), times: JSON.stringify(times), status: "active" },
    include: launcherInclude,
  });
  return ok({ launcher: serializeLauncher(launcher) }, { status: 201 });
});
