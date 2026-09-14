import fs from "node:fs";
import path from "node:path";
import { db } from "../db";
import { newId } from "../ids";
import { refundCredits } from "../credits";
import { getCaptionStyle, CLIP_DURATIONS, type CaptionStyle } from "../caption-styles";
import { storageDir, storageUrl } from "./bin";
import { downloadSubtitles, downloadVideo, fetchMetadata } from "./ytdlp";
import { groupWords, wordsInRange, type Word } from "./transcript";
import { parseJson3 } from "./json3";
import { selectHighlights } from "./highlights";
import { makeThumbnail, makeVerticalThumbnail, probe, renderClip } from "./render";

async function setProject(id: string, data: Record<string, unknown>) {
  await db.project.update({ where: { id }, data });
}

function styleFor(templateJson: string | null | undefined, projectJson: string): CaptionStyle {
  const raw = templateJson || projectJson;
  try {
    const t = JSON.parse(raw) as Partial<CaptionStyle> & { id?: string };
    const base = getCaptionStyle(t.id);
    return { ...base, ...t } as CaptionStyle;
  } catch {
    return getCaptionStyle("green-fresh");
  }
}

export async function processProject(projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return;
  const dir = storageDir("projects", projectId);
  try {
    // 1. Download
    await setProject(projectId, { status: "downloading", stage: "Baixando o vídeo", progress: 2, error: null });
    let src = project.sourcePath && fs.existsSync(project.sourcePath) ? project.sourcePath : null;
    if (!src) {
      if (!project.url) throw new Error("Projeto sem URL nem arquivo de origem");
      if (!project.videoId || !project.durationSec) {
        const meta = await fetchMetadata(project.url);
        await setProject(projectId, {
          videoId: meta.videoId,
          title: project.title || meta.title,
          thumbnailUrl: meta.thumbnailUrl,
          channelTitle: meta.channelTitle,
          durationSec: meta.durationSec,
          language: meta.language,
          endTime: project.endTime || meta.durationSec,
        });
      }
      let last = 0;
      src = await downloadVideo(project.url, dir, (pct) => {
        const p = 2 + Math.round(pct * 0.38);
        if (p !== last) {
          last = p;
          setProject(projectId, { progress: p }).catch(() => {});
        }
      });
      await setProject(projectId, { sourcePath: src });
    }
    const info = await probe(src);
    const fresh = await db.project.findUnique({ where: { id: projectId } });
    if (!fresh) return;
    const durationSec = fresh.durationSec || info.duration;
    const windowStart = Math.max(0, fresh.startTime || 0);
    const windowEnd = fresh.endTime && fresh.endTime > windowStart ? Math.min(fresh.endTime, durationSec) : durationSec;
    if (!fresh.thumbnailUrl || fresh.platform === "upload") {
      const thumb = path.join(dir, "thumb.jpg");
      await makeThumbnail(src, Math.min(5, durationSec / 2), thumb, 640);
      await setProject(projectId, { thumbnailUrl: storageUrl(thumb) });
    }
    await setProject(projectId, { durationSec, endTime: windowEnd, progress: 42 });

    // 2. Transcrição
    await setProject(projectId, { status: "transcribing", stage: "Transcrevendo o áudio", progress: 44 });
    let words: Word[] = [];
    if (fresh.transcript) {
      words = JSON.parse(fresh.transcript);
    } else if (fresh.url && fresh.platform !== "upload") {
      const pref = fresh.language ? [fresh.language, "pt", "en"] : ["pt", "pt-BR", "en"];
      const subFile = await downloadSubtitles(fresh.url, dir, pref);
      if (subFile) words = parseJson3(subFile);
      await setProject(projectId, { transcript: JSON.stringify(words) });
    }
    await setProject(projectId, { progress: 56 });

    // 3. Seleção de momentos
    await setProject(projectId, { status: "analyzing", stage: "Encontrando os melhores momentos", progress: 58 });
    const pref = CLIP_DURATIONS.find((d) => d.id === fresh.clipDuration) || CLIP_DURATIONS[0];
    const existing = await db.short.count({ where: { projectId } });
    if (existing === 0) {
      const { clips } = await selectHighlights({
        words,
        windowStart,
        windowEnd,
        count: fresh.targetClips,
        minDur: pref.min,
        maxDur: pref.max,
        language: fresh.language,
        videoTitle: fresh.title,
      });
      if (!clips.length) throw new Error("Não foi possível encontrar momentos neste trecho do vídeo.");
      const style = styleFor(null, fresh.captionTemplate);
      let slot = 1;
      for (const c of clips) {
        const groups = groupWords(wordsInRange(words, c.start, c.end), style.wordsPerGroup, style.maxChars);
        await db.short.create({
          data: {
            id: newId(),
            projectId,
            slot: slot++,
            title: c.title,
            reason: c.reason,
            hook: c.hook,
            score: c.score,
            startTime: c.start,
            endTime: c.end,
            layout: fresh.layout === "auto" ? (info.width / info.height > 1.4 ? "single" : "center") : fresh.layout,
            captions: JSON.stringify(groups),
            watermark: fresh.isFree,
            status: "pending",
          },
        });
      }
    }
    await setProject(projectId, { progress: 66, estimatedClips: await db.short.count({ where: { projectId } }) });

    // 4. Prévias
    await setProject(projectId, { status: "generating", stage: "Montando e preparando os cortes", progress: 68 });
    const shorts = await db.short.findMany({ where: { projectId, status: "pending" }, orderBy: { slot: "asc" } });
    const total = shorts.length || 1;
    let done = 0;
    for (const s of shorts) {
      const sdir = storageDir("projects", projectId, "shorts", s.id);
      const thumb = path.join(sdir, "thumb.jpg");
      const preview = path.join(sdir, "preview.mp4");
      try {
        await makeVerticalThumbnail(src, s.startTime + 1, thumb, s.layout, 360);
        const style = styleFor(s.captionTemplate, fresh.captionTemplate);
        const groups = JSON.parse(s.captions || "[]");
        await renderClip({
          src,
          start: s.startTime,
          end: s.endTime,
          layout: s.layout,
          style,
          groups,
          out: preview,
          width: 540,
          crf: 28,
          preset: "veryfast",
          watermark: s.watermark,
          hook: null,
          captionsEnabled: !fresh.ignoreCaptions,
        });
        await db.short.update({ where: { id: s.id }, data: { status: "ready", thumbnailUrl: storageUrl(thumb), previewUrl: storageUrl(preview) } });
      } catch (e) {
        await db.short.update({ where: { id: s.id }, data: { status: "failed" } });
        console.error("[pipeline] prévia falhou", s.id, (e as Error).message);
      }
      done++;
      await setProject(projectId, { progress: 68 + Math.round((done / total) * 30) });
    }
    await setProject(projectId, { status: "ready", stage: "Cortes prontos", progress: 100 });
  } catch (e) {
    const msg = (e as Error).message || "Erro desconhecido";
    console.error("[pipeline] projeto falhou", projectId, msg);
    await setProject(projectId, { status: "failed", stage: "Falhou", error: msg.slice(0, 500) });
    const p = await db.project.findUnique({ where: { id: projectId } });
    if (p && p.creditsCharged > 0) {
      await refundCredits(p.userId, p.creditsCharged, `Estorno: projeto "${p.title}" falhou`, projectId);
      await setProject(projectId, { creditsCharged: 0 });
    }
  }
}

export async function processRender(renderId: string) {
  const render = await db.render.findUnique({ where: { id: renderId }, include: { short: { include: { project: true } } } });
  if (!render) return;
  const { short } = render;
  const project = short.project;
  try {
    await db.render.update({ where: { id: renderId }, data: { status: "processing", progress: 1 } });
    await db.short.update({ where: { id: short.id }, data: { status: "rendering", renderProgress: 1 } });
    if (!project.sourcePath || !fs.existsSync(project.sourcePath)) throw new Error("Arquivo de origem não encontrado (o projeto pode ter expirado).");
    const dir = storageDir("renders", render.userId);
    const out = path.join(dir, `${short.id}-${render.id.slice(-6)}.mp4`);
    const style = styleFor(short.captionTemplate, project.captionTemplate);
    const groups = JSON.parse(short.captions || "[]");
    let last = 0;
    await renderClip({
      src: project.sourcePath,
      start: short.startTime,
      end: short.endTime,
      layout: short.layout,
      style,
      groups,
      out,
      width: render.resolution === "720x1280" ? 720 : 1080,
      crf: 21,
      preset: "faster",
      watermark: render.watermark,
      hook: short.hook && project.autoCta ? short.hook : null,
      captionsEnabled: !project.ignoreCaptions,
      onProgress: (pct) => {
        if (pct - last >= 3) {
          last = pct;
          db.render.update({ where: { id: renderId }, data: { progress: pct } }).catch(() => {});
          db.short.update({ where: { id: short.id }, data: { renderProgress: pct } }).catch(() => {});
        }
      },
    });
    const url = storageUrl(out);
    await db.render.update({ where: { id: renderId }, data: { status: "done", progress: 100, filePath: out, url, durationSec: short.endTime - short.startTime, completedAt: new Date() } });
    await db.short.update({ where: { id: short.id }, data: { status: "rendered", renderProgress: 100, renderUrl: url, renderedAt: new Date() } });
  } catch (e) {
    const msg = (e as Error).message || "Erro desconhecido";
    console.error("[pipeline] render falhou", renderId, msg);
    await db.render.update({ where: { id: renderId }, data: { status: "failed", error: msg.slice(0, 500) } });
    await db.short.update({ where: { id: short.id }, data: { status: short.renderUrl ? "rendered" : "ready", renderProgress: 0 } });
  }
}
