import { z } from "zod";
import { ok, readJson, withUser } from "@/lib/api";
import { estimateClips, fetchMetadata } from "@/lib/video/ytdlp";

const schema = z.object({ url: z.string().min(5, "Cole um link"), clipDuration: z.string().optional() });

export const POST = withUser(async ({ req }) => {
  const body = schema.parse(await readJson(req));
  const meta = await fetchMetadata(body.url);
  meta.estimatedClips = estimateClips(meta.durationSec, body.clipDuration || "auto");
  return ok({ message: "Dados do vídeo obtidos com sucesso.", data: meta });
});
