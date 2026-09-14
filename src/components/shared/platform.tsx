"use client";

import { cn } from "@/lib/utils";

export type PlatformId = "youtube" | "instagram" | "tiktok";

export const PLATFORMS: Array<{ id: PlatformId; name: string; short: string; color: string; hint: string }> = [
  { id: "youtube", name: "YouTube", short: "YT", color: "#ff0033", hint: "Shorts" },
  { id: "instagram", name: "Instagram", short: "IG", color: "#e1306c", hint: "Reels" },
  { id: "tiktok", name: "TikTok", short: "TT", color: "#25f4ee", hint: "TikTok" },
];

export function platformInfo(id: string) {
  return PLATFORMS.find((p) => p.id === id) ?? { id: id as PlatformId, name: id, short: id.slice(0, 2).toUpperCase(), color: "#888", hint: "" };
}

export function PlatformDot({ platform, className, size = "md" }: { platform: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const p = platformInfo(platform);
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-md font-mono font-bold uppercase text-white", size === "sm" ? "size-5 text-[9px]" : size === "lg" ? "size-10 text-sm" : "size-7 text-[10px]", className)}
      style={{ background: p.color, color: platform === "tiktok" ? "#000" : "#fff" }}
      title={p.name}
    >
      {p.short}
    </span>
  );
}

export function PlatformBadge({ platform, className }: { platform: string; className?: string }) {
  const p = platformInfo(platform);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold", className)}>
      <span className="size-1.5 rounded-full" style={{ background: p.color }} />
      {p.name}
    </span>
  );
}

export function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1).replace(".", ",")} ${units[i]}`;
}
