import fs from "node:fs";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, readJson, withUser } from "@/lib/api";
import { storageDir } from "@/lib/video/bin";
import { enqueue } from "@/lib/video/queue";

const patchSchema = z.object({ title: z.string().min(1).max(200).optional() });

export const GET = withUser(async ({ req, params, user }) => {
  const u = new URL(req.url);
  const page = Math.max(1, Number(u.searchParams.get("page")) || 1);
  const limit = Math.min(96, Number(u.searchParams.get("limit")) || 12);
  const sort = u.searchParams.get("sort") || "score";
  const filter = u.searchParams.get("filter") || "all";
  const project = await db.project.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!project) return fail("Projeto não encontrado", 404);
  const where = {
    projectId: project.id,
    ...(filter === "rendered" ? { status: "rendered" } : {}),
    ...(filter === "not_rendered" ? { status: { in: ["ready", "pending", "rendering"] } } : {}),
    ...(filter === "launcher" ? { isInLauncher: true } : {}),
    ...(filter === "scheduled" ? { isScheduled: true } : {}),
    ...(filter === "published" ? { isPublished: true } : {}),
  };
  const orderBy =
    sort === "time" ? { startTime: "asc" as const } : sort === "duration" ? { endTime: "desc" as const } : sort === "title" ? { title: "asc" as const } : { score: "desc" as const };
  const [total, shorts, meta] = await Promise.all([
    db.short.count({ where }),
    db.short.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit }),
    db.short.aggregate({ where: { projectId: project.id }, _avg: { score: true }, _count: true }),
  ]);
  const avgDur = await db.short.findMany({ where: { projectId: project.id }, select: { startTime: true, endTime: true } });
  const averageDuration = avgDur.length ? avgDur.reduce((a, s) => a + (s.endTime - s.startTime), 0) / avgDur.length : 0;
  return ok({
    project: { ...project, transcript: undefined, shortsCount: meta._count },
    data: shorts.map((s) => ({ ...s, captions: undefined })),
    page,
    limit,
    total,
    lastPage: Math.max(1, Math.ceil(total / limit)),
    meta: { averageScore: meta._avg.score || 0, averageDuration },
  });
});

export const PATCH = withUser(async ({ req, params, user }) => {
  const body = patchSchema.parse(await readJson(req));
  const project = await db.project.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!project) return fail("Projeto não encontrado", 404);
  const updated = await db.project.update({ where: { id: project.id }, data: body });
  return ok({ project: { ...updated, transcript: undefined } });
});

export const DELETE = withUser(async ({ params, user }) => {
  const project = await db.project.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!project) return fail("Projeto não encontrado", 404);
  await db.project.delete({ where: { id: project.id } });
  try {
    fs.rmSync(storageDir("projects", project.id), { recursive: true, force: true });
  } catch {}
  return ok({ ok: true });
});

/** Reprocessa um projeto que falhou. */
export const POST = withUser(async ({ params, user }) => {
  const project = await db.project.findFirst({ where: { id: params.id, userId: user!.id } });
  if (!project) return fail("Projeto não encontrado", 404);
  if (!["failed", "expired"].includes(project.status)) return fail("Este projeto não precisa ser reprocessado", 400);
  await db.project.update({ where: { id: project.id }, data: { status: "queued", stage: "Na fila", error: null, progress: 0 } });
  enqueue({ kind: "project", id: project.id });
  return ok({ ok: true });
});
