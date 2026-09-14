"use client";

import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, FORUM_CATEGORIES } from "@/lib/forum";

export const ALL_CATEGORIES = "todos";

export function CategoryPills({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const items = [{ value: ALL_CATEGORIES, label: "Todos" }, ...FORUM_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))];
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="tablist" aria-label="Categorias">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cn(
              "h-8 rounded-full border px-3.5 text-xs font-semibold transition cursor-pointer",
              active ? "border-primary bg-primary text-primary-foreground shadow-[0_6px_20px_-8px_var(--primary)]" : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
