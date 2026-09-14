import fs from "node:fs";
import path from "node:path";
import { isSubscriber } from "@/lib/auth";
import { fail, ok, withUser } from "@/lib/api";
import { newId } from "@/lib/ids";
import { storageDir } from "@/lib/video/bin";
import { probe } from "@/lib/video/render";
import { estimateClips } from "@/lib/video/ytdlp";

export const runtime = "nodejs";

export const POST = withUser(async ({ req, user }) => {
  if (!isSubscriber(user!)) return fail("Enviar arquivos do computador é exclusivo dos planos. Assine para desbloquear o upload.", 403);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return fail("Arquivo não enviado", 422);
  if (!/^video\//.test(file.type) && !/\.(mp4|mov|webm|mkv|m4v)$/i.test(file.name)) return fail("Envie um arquivo de vídeo (MP4, MOV, WEBM)", 422);
  const id = newId();
  const dir = storageDir("uploads", user!.id);
  const ext = path.extname(file.name) || ".mp4";
  const dest = path.join(dir, `${id}${ext}`);
  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(dest, buf);
  const info = await probe(dest);
  return ok({
    path: dest,
    meta: {
      platform: "upload",
      videoId: id,
      url: null,
      title: file.name.replace(/\.[^.]+$/, ""),
      description: "",
      thumbnailUrl: null,
      channelTitle: null,
      channelId: null,
      durationSec: info.duration,
      language: null,
      views: null,
      likes: null,
      comments: null,
      publishedAt: null,
      tags: [],
      estimatedClips: estimateClips(info.duration, "auto"),
    },
  });
});
