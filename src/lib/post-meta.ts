import fs from "node:fs";
import { z } from "zod";

/**
 * Metadados completos de um post (ScheduledPost.meta, JSON). Sem eles o publicador usa a legenda:
 * 1ª linha vira título, hashtags viram tags (youtubeTexts).
 */
export const youtubeMetaSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  /** 20 = Games, 22 = Pessoas e blogs, 24 = Entretenimento, 25 = Notícias e política */
  categoryId: z.string().regex(/^\d+$/, "categoryId é numérico (ex.: 20 = Games)").optional(),
  playlistId: z.string().trim().min(1).optional(),
  /** ISO 8601 com fuso: o vídeo sobe privado e o YouTube publica nessa hora */
  publishAt: z.string().datetime({ offset: true }).optional(),
  privacy: z.enum(["public", "unlisted", "private"]).optional(),
  madeForKids: z.boolean().default(false),
  /** Caminho local de JPG/PNG até 2 MB (1280x720 recomendado) */
  thumbnailPath: z.string().min(1).optional(),
});

export const postMetaSchema = z.object({
  youtube: youtubeMetaSchema.optional(),
  /** MP4 local (ex.: render do Remotion do estúdio) no lugar de um corte do Cortix */
  videoPath: z.string().min(1).optional(),
  /** Carrossel de fotos (Instagram/Facebook pela Meta; Instagram/TikTok via Upload-Post), 1 a 10 imagens JPG/PNG locais, na ordem */
  carousel: z.object({ images: z.array(z.string().min(1)).min(1).max(10), title: z.string().max(200).optional() }).optional(),
  /** Reel do Instagram: capa (JPG/PNG local, hospedada na hora) ou quadro do vídeo em ms; shareToFeed padrão true */
  instagram: z
    .object({
      coverPath: z.string().min(1).optional(),
      thumbOffsetMs: z.number().int().min(0).optional(),
      shareToFeed: z.boolean().optional(),
    })
    .optional(),
});

export type YoutubeMeta = z.infer<typeof youtubeMetaSchema>;
export type PostMeta = z.infer<typeof postMetaSchema>;

/** Valida os arquivos locais e datas citados no meta. Devolve a mensagem do erro ou null. */
export function checkPostMeta(meta: PostMeta | null | undefined): string | null {
  const th = meta?.youtube?.thumbnailPath;
  if (th) {
    if (!fs.existsSync(th)) return `Thumbnail não encontrada: ${th}`;
    if (!/\.(jpe?g|png)$/i.test(th)) return "A thumbnail precisa ser .jpg ou .png";
    if (fs.statSync(th).size > 2 * 1024 * 1024) return "A thumbnail passa de 2 MB (limite do YouTube)";
  }
  const vp = meta?.videoPath;
  if (vp && (!fs.existsSync(vp) || !/\.(mp4|mov)$/i.test(vp))) return `Vídeo não encontrado (ou não é .mp4/.mov): ${vp}`;
  for (const img of meta?.carousel?.images ?? []) {
    if (!fs.existsSync(img)) return `Imagem do carrossel não encontrada: ${img}`;
    if (!/\.(jpe?g|png)$/i.test(img)) return `Imagem do carrossel precisa ser .jpg ou .png: ${img}`;
  }
  if (vp && meta?.carousel) return "Use videoPath OU carousel, não os dois";
  const cover = meta?.instagram?.coverPath;
  if (cover && (!fs.existsSync(cover) || !/\.(jpe?g|png)$/i.test(cover))) return `Capa do Reel não encontrada (ou não é .jpg/.png): ${cover}`;
  const at = meta?.youtube?.publishAt;
  if (at && Date.parse(at) < Date.now()) return "publishAt precisa ser no futuro";
  return null;
}

export function parsePostMeta(json: string | null | undefined): PostMeta {
  if (!json) return {};
  try {
    return postMetaSchema.parse(JSON.parse(json));
  } catch {
    return {};
  }
}

/**
 * Título = meta.title, ou 1ª linha da legenda, ou título do corte (máx. 100 caracteres).
 * Descrição = meta.description ou a legenda, com #Shorts. Tags = meta.tags ou as hashtags da legenda.
 */
export function youtubeTexts(caption: string, fallbackTitle: string, yt?: YoutubeMeta) {
  const linhas = caption.trim().split(/\r?\n/);
  let title = (yt?.title || linhas[0] || fallbackTitle).replace(/[<>]/g, "").trim() || fallbackTitle;
  if (title.length > 100) title = title.slice(0, 97).trimEnd() + "...";
  let description = yt?.description?.trim() || caption.trim() || fallbackTitle;
  if (!/#shorts\b/i.test(description)) description += "\n\n#Shorts";
  const tags = yt?.tags?.length ? yt.tags.slice(0, 30) : Array.from(new Set((caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.slice(1)))).slice(0, 15);
  return { title, description: description.replace(/[<>]/g, "").slice(0, 5000), tags };
}
