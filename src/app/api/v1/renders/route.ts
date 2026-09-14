import { db } from "@/lib/db";
import { ok, withUser } from "@/lib/api";

export const GET = withUser(async ({ req, user }) => {
  const u = new URL(req.url);
  const page = Math.max(1, Number(u.searchParams.get("page")) || 1);
  const limit = Math.min(100, Number(u.searchParams.get("limit")) || 20);
  const projectId = u.searchParams.get("projectId");
  const where = { userId: user!.id, ...(projectId ? { short: { projectId } } : {}) };
  const [total, renders, projects] = await Promise.all([
    db.render.count({ where }),
    db.render.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { short: { select: { id: true, title: true, projectId: true, thumbnailUrl: true, startTime: true, endTime: true, project: { select: { id: true, title: true } } } } },
    }),
    db.project.findMany({ where: { userId: user!.id }, select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const doneCount = await db.render.count({ where: { userId: user!.id, status: "done" } });
  return ok({ data: renders, page, limit, total, lastPage: Math.max(1, Math.ceil(total / limit)), doneCount, projects });
});
