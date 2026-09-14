import { db } from "../db";
import { processProject, processRender } from "./pipeline";

type Job = { kind: "project"; id: string } | { kind: "render"; id: string };

interface QueueState {
  projects: string[];
  renders: string[];
  runningProject: string | null;
  runningRender: string | null;
  booted: boolean;
}

const g = globalThis as unknown as { __cfQueue?: QueueState };
const state: QueueState = (g.__cfQueue ??= { projects: [], renders: [], runningProject: null, runningRender: null, booted: false });

async function pumpProjects() {
  if (state.runningProject) return;
  const id = state.projects.shift();
  if (!id) return;
  state.runningProject = id;
  try {
    await processProject(id);
  } catch (e) {
    console.error("[queue] projeto", id, e);
  } finally {
    state.runningProject = null;
    setImmediate(pumpProjects);
  }
}

async function pumpRenders() {
  if (state.runningRender) return;
  const id = state.renders.shift();
  if (!id) return;
  state.runningRender = id;
  try {
    await processRender(id);
  } catch (e) {
    console.error("[queue] render", id, e);
  } finally {
    state.runningRender = null;
    setImmediate(pumpRenders);
  }
}

export function enqueue(job: Job) {
  if (job.kind === "project") {
    if (!state.projects.includes(job.id) && state.runningProject !== job.id) state.projects.push(job.id);
    setImmediate(pumpProjects);
  } else {
    if (!state.renders.includes(job.id) && state.runningRender !== job.id) state.renders.push(job.id);
    setImmediate(pumpRenders);
  }
}

export function queueStatus() {
  return { ...state };
}

/** Recoloca na fila trabalhos interrompidos (ex.: servidor reiniciou). */
export async function bootQueue() {
  if (state.booted) return;
  state.booted = true;
  try {
    const stale = await db.project.findMany({
      where: { status: { in: ["queued", "downloading", "transcribing", "analyzing", "generating"] } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    for (const p of stale) enqueue({ kind: "project", id: p.id });
    const renders = await db.render.findMany({ where: { status: { in: ["queued", "processing"] } }, select: { id: true }, orderBy: { createdAt: "asc" } });
    for (const r of renders) enqueue({ kind: "render", id: r.id });
    // expira projetos gratuitos vencidos
    await db.project.updateMany({ where: { isFree: true, expiresAt: { lt: new Date() }, status: { not: "expired" } }, data: { status: "expired" } });
  } catch (e) {
    console.error("[queue] boot falhou", e);
  }
}
