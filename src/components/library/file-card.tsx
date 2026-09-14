"use client";

import { Download, File, FileAudio, FileImage, FileText, FileVideo, Folder, Globe, Lock, Trash2 } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { formatBytes } from "@/components/shared/platform";

export interface LibraryFileItem {
  id: string;
  name: string;
  folder: string;
  url: string;
  size: number;
  mime: string;
  isPublic: boolean;
  createdAt: string;
  isMine: boolean;
  author: string;
}

export function fileIcon(mime: string) {
  if (mime === "folder") return Folder;
  if (mime.startsWith("image/")) return FileImage;
  if (mime.startsWith("video/")) return FileVideo;
  if (mime.startsWith("audio/")) return FileAudio;
  if (mime.startsWith("text/") || mime.includes("pdf") || mime.includes("document") || mime.includes("json")) return FileText;
  return File;
}

export function fileKind(mime: string) {
  if (mime === "folder") return "Pasta";
  if (mime.startsWith("image/")) return "Imagem";
  if (mime.startsWith("video/")) return "Vídeo";
  if (mime.startsWith("audio/")) return "Áudio";
  if (mime.includes("pdf")) return "PDF";
  if (mime.startsWith("text/")) return "Texto";
  return mime.split("/")[1]?.toUpperCase().slice(0, 8) || "Arquivo";
}

export function FileCard({ f, onOpenFolder, onTogglePublic, onDelete }: { f: LibraryFileItem; onOpenFolder?: () => void; onTogglePublic?: () => void; onDelete?: () => void }) {
  const Icon = fileIcon(f.mime);
  const isFolder = f.mime === "folder";
  const isImage = f.mime.startsWith("image/");
  const isVideo = f.mime.startsWith("video/");
  return (
    <div className={cn("group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition", isFolder && "cursor-pointer hover:border-primary/60")} onClick={isFolder ? onOpenFolder : undefined}>
      <div className="relative flex aspect-[4/3] items-center justify-center bg-secondary/50">
        {isImage && f.url ? (
          <img src={f.url} alt="" className="size-full object-cover" />
        ) : isVideo && f.url ? (
          <video src={f.url} className="size-full object-cover" muted preload="metadata" />
        ) : (
          <Icon className={cn("size-10", isFolder ? "text-warning" : "text-muted-foreground")} />
        )}
        <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] uppercase text-white">{fileKind(f.mime)}</span>
        {!isFolder ? (
          <span className={cn("absolute right-2 top-2 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase", f.isPublic ? "bg-success/80 text-black" : "bg-black/60 text-white")}>{f.isPublic ? "Público" : "Privado"}</span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="truncate text-sm font-semibold" title={f.name}>
          {f.name}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {isFolder ? "Pasta" : formatBytes(f.size)} · {f.isMine ? `há ${timeAgo(f.createdAt)}` : `por ${f.author}`}
        </p>
        <div className="mt-2 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {!isFolder && f.url ? (
            <a href={`${f.url}?download=${encodeURIComponent(f.name)}`} className="flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-semibold hover:bg-secondary" title="Baixar">
              <Download className="size-3.5" /> Baixar
            </a>
          ) : (
            <span className="flex-1" />
          )}
          {onTogglePublic && !isFolder ? (
            <button className="rounded-md border p-1.5 hover:bg-secondary" title={f.isPublic ? "Tornar privado" : "Tornar público"} onClick={onTogglePublic}>
              {f.isPublic ? <Lock className="size-3.5" /> : <Globe className="size-3.5" />}
            </button>
          ) : null}
          {onDelete ? (
            <button className="rounded-md border p-1.5 text-destructive hover:bg-destructive/10" title="Excluir" onClick={onDelete}>
              <Trash2 className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
