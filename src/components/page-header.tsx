import { cn } from "@/lib/utils";

export function PageHeader({ eyebrow, title, description, actions, className, dot }: { eyebrow?: string; title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="eyebrow mb-3 flex items-center gap-2">
            {dot ? <span className="size-1.5 rounded-full bg-success" /> : null}
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Page({ children, className, wide }: { children: React.ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn("mx-auto w-full px-4 py-6 md:px-8 md:py-8", wide ? "max-w-[1400px]" : "max-w-6xl", className)}>{children}</div>;
}

export function FreePlanNotice({ text = "Seus projetos saem com marca d'água. Assine qualquer plano e ela é removida de todos os seus vídeos, inclusive os que você já criou." }: { text?: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-warning/40 bg-warning/5 px-5 py-4 md:flex-row md:items-center">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-warning/60 text-warning">!</span>
      <div className="flex-1">
        <p className="text-sm font-semibold">Você está no plano gratuito</p>
        <p className="text-xs text-muted-foreground">{text}</p>
      </div>
      <a href="/financeiro?tab=plans" className="eyebrow !text-warning underline-offset-4 hover:underline">
        Ver planos ↗
      </a>
    </div>
  );
}

export function Paywall({ title, description, icon }: { title: string; description: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border bg-card px-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary [&_svg]:size-8">{icon ?? "🔒"}</div>
      <p className="text-lg font-semibold">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      <a href="/financeiro?tab=plans" className="mt-2 inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
        Ver planos
      </a>
    </div>
  );
}
