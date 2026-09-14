"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Home, Trophy, MessagesSquare, UserPlus, DollarSign, Wallet, FolderOpen, PenSquare, Clapperboard, Palette, LayoutTemplate, BarChart3, Radio, Library, CalendarClock, Share2, Rocket, Sparkles,
  PanelLeft, ChevronsUpDown, ClipboardList, Coins, Languages, SunMoon, Eye, EyeOff, ChevronsUp, LogOut, Settings,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api, setUserCache, useUser } from "@/lib/hooks";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input, Label } from "./ui/input";

const NAV: Array<{ n: string; label: string; items: Array<{ href: string; label: string; icon: React.ElementType; badge?: string | number; action?: "editor" }> }> = [
  {
    n: "01",
    label: "Ganhar",
    items: [
      { href: "/quests", label: "Missões", icon: Trophy },
      { href: "/forum", label: "Comunidade", icon: MessagesSquare },
      { href: "/convidar", label: "Convidar amigos", icon: UserPlus },
      { href: "/campeonatos", label: "Campanhas", icon: DollarSign, badge: 7 },
      { href: "/financeiro", label: "Financeiro", icon: Wallet },
    ],
  },
  {
    n: "02",
    label: "Criar",
    items: [
      { href: "/projects", label: "Projetos", icon: FolderOpen },
      { href: "/editor", label: "Editor", icon: PenSquare, action: "editor" },
      { href: "/renders", label: "Meus Vídeos", icon: Clapperboard },
      { href: "/brand-kit", label: "Brand Kit", icon: Palette },
      { href: "/templates", label: "Templates", icon: LayoutTemplate },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    n: "03",
    label: "Capturar",
    items: [
      { href: "/lives", label: "Lives", icon: Radio },
      { href: "/library", label: "Biblioteca", icon: Library },
    ],
  },
  {
    n: "04",
    label: "Publicar",
    items: [
      { href: "/schedule", label: "Agendamento", icon: CalendarClock },
      { href: "/social-media", label: "Redes Sociais", icon: Share2 },
      { href: "/launcher", label: "Launchers", icon: Rocket },
    ],
  },
  {
    n: "05",
    label: "Mais",
    items: [{ href: "/connect-ai", label: "Conectar IA", icon: Sparkles }],
  },
];

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/quests": "Quests",
  "/forum": "Fórum",
  "/convidar": "Convidar",
  "/campeonatos": "Campeonatos",
  "/financeiro": "Financeiro",
  "/projects": "Projetos",
  "/criar-projeto": "Novo Projeto",
  "/renders": "Meus Vídeos",
  "/brand-kit": "Brand-kit",
  "/templates": "Templates",
  "/analytics": "Analytics",
  "/lives": "Lives",
  "/library": "Library",
  "/schedule": "Schedule",
  "/social-media": "Social-media",
  "/launcher": "Launcher",
  "/connect-ai": "Conectar IA",
  "/settings": "Configurações",
};

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="relative inline-flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-[0_6px_20px_-6px_var(--primary)]">
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
          <path d="M6 4l12 8-12 8z" />
        </svg>
      </span>
      <span className="text-lg">Cortix</span>
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, refresh } = useUser();
  const [collapsed, setCollapsed] = useState(false);
  const [hideIdentity, setHideIdentity] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [blankOpen, setBlankOpen] = useState(false);

  const isEditor = /\/editor\//.test(pathname);
  if (isEditor) return <>{children}</>;

  const crumb = TITLES[pathname] || (pathname.startsWith("/projects/") ? "Detalhes do Projeto" : pathname.startsWith("/campeonatos/") ? "Campeonato" : "");

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    setUserCache(null);
    router.push("/login");
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <aside className={cn("hidden h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all md:flex", collapsed ? "w-16" : "w-64")}>
        <div className={cn("flex h-16 items-center px-4", collapsed && "justify-center px-0")}>
          <Link href="/dashboard">{collapsed ? <Logo className="[&>span:last-child]:hidden" /> : <Logo />}</Link>
        </div>
        <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-4">
          <NavLink href="/dashboard" label="Início" icon={Home} active={pathname === "/dashboard"} collapsed={collapsed} />
          {NAV.map((g) => (
            <div key={g.n} className="mt-4">
              {!collapsed ? (
                <div className="mb-1 flex items-center gap-2 px-2">
                  <span className="size-1.5 rounded-full border border-muted-foreground/60" />
                  <span className="eyebrow">
                    {g.n} {g.label}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              ) : (
                <div className="mx-auto my-2 h-px w-6 bg-border" />
              )}
              {g.items.map((it) =>
                it.action === "editor" ? (
                  <button key={it.href} onClick={() => setBlankOpen(true)} className={cn(navCls(false, collapsed))} title={it.label}>
                    <it.icon className="size-4 shrink-0" />
                    {!collapsed ? <span className="flex-1 text-left">{it.label}</span> : null}
                  </button>
                ) : (
                  <NavLink key={it.href} href={it.href} label={it.label} icon={it.icon} active={pathname.startsWith(it.href)} collapsed={collapsed} badge={it.badge} />
                ),
              )}
            </div>
          ))}
        </nav>
        <div className={cn("flex items-center gap-2 border-t border-sidebar-border p-3", collapsed && "justify-center")}>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">{initials(user?.name)}</div>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{hideIdentity ? "••••••" : user?.name || "…"}</p>
              <p className="truncate text-xs text-muted-foreground">{hideIdentity ? "••••••@••••" : user?.email || ""}</p>
            </div>
          ) : null}
          {!collapsed ? (
            <>
              <button className="rounded-md p-1 text-muted-foreground hover:bg-secondary" title="Configurações" onClick={() => router.push("/settings")}>
                <ChevronsUp className="size-4" />
              </button>
              <button className="rounded-md p-1 text-muted-foreground hover:bg-secondary" title="Ocultar nome e e-mail" onClick={() => setHideIdentity((v) => !v)}>
                {hideIdentity ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </>
          ) : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
          <button className="rounded-md p-2 text-muted-foreground hover:bg-secondary" onClick={() => setCollapsed((v) => !v)} title="Toggle Sidebar">
            <PanelLeft className="size-4" />
          </button>
          <button className="hidden h-11 items-center gap-3 rounded-xl border bg-card px-3 sm:flex" title="Você está em Meu espaço. Trocar de espaço">
            <span className="flex size-7 items-center justify-center rounded-md bg-secondary text-muted-foreground">
              <Settings className="size-3.5" />
            </span>
            <span className="text-left leading-tight">
              <span className="block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Espaço de trabalho</span>
              <span className="block text-sm font-semibold">Meu espaço</span>
            </span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-2 text-sm">
            {pathname.startsWith("/projects/") || pathname === "/criar-projeto" ? (
              <>
                <Link href="/projects" className="text-muted-foreground hover:text-foreground">
                  Projetos
                </Link>
                <span className="text-muted-foreground">/</span>
              </>
            ) : null}
            <span className="font-medium">{crumb}</span>
          </div>
          <div className="flex-1" />
          {!user?.surveyDone ? (
            <button onClick={() => setSurveyOpen(true)} className="hidden items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/20 sm:flex" title="Responda a pesquisa e ganhe 60 créditos">
              <ClipboardList className="size-4" />
              Pesquisa · +60
            </button>
          ) : null}
          <Link href="/financeiro" className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-semibold hover:bg-secondary">
            <Coins className="size-4 text-muted-foreground" />
            {user ? `${user.credits} Créditos` : "…"}
          </Link>
          <button className="hidden items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-muted-foreground hover:bg-secondary sm:flex" title="Idioma">
            <Languages className="size-4" /> <span className="text-[10px]">BR</span> PT
          </button>
          <button className="rounded-md border p-2 text-muted-foreground hover:bg-secondary" title="Toggle theme" onClick={() => document.documentElement.classList.toggle("dark")}>
            <SunMoon className="size-4" />
          </button>
          <button className="rounded-md border p-2 text-muted-foreground hover:bg-secondary" title="Sair" onClick={logout}>
            <LogOut className="size-4" />
          </button>
        </header>
        <main className="scrollbar-thin min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <SurveyDialog open={surveyOpen} onOpenChange={setSurveyOpen} onDone={refresh} />
      <BlankProjectDialog open={blankOpen} onOpenChange={setBlankOpen} />
    </div>
  );
}

function navCls(active: boolean, collapsed: boolean) {
  return cn(
    "group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-sidebar-foreground/85 transition hover:bg-sidebar-accent hover:text-foreground cursor-pointer",
    active && "bg-sidebar-accent font-semibold text-foreground shadow-[inset_2px_0_0_var(--primary)]",
    collapsed && "justify-center px-0",
  );
}

function NavLink({ href, label, icon: Icon, active, collapsed, badge }: { href: string; label: string; icon: React.ElementType; active: boolean; collapsed: boolean; badge?: string | number }) {
  return (
    <Link href={href} className={navCls(active, collapsed)} title={label}>
      <Icon className="size-4 shrink-0" />
      {!collapsed ? <span className="flex-1">{label}</span> : null}
      {!collapsed && badge !== undefined ? <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{badge}</span> : null}
      {!collapsed && badge === undefined ? <span className="text-[10px] text-muted-foreground/40 opacity-0 transition group-hover:opacity-100">▸</span> : null}
    </Link>
  );
}

function initials(name?: string) {
  if (!name) return "…";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function SurveyDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const [role, setRole] = useState("clipador");
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit() {
    setLoading(true);
    try {
      await api("/api/v1/survey", { method: "POST", json: { role, goal } });
      toast.success("Obrigado! 60 créditos adicionados à sua conta.");
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Responda a pesquisa e ganhe 60 créditos</DialogTitle>
          <DialogDescription>Leva menos de um minuto e nos ajuda a melhorar o Cortix.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>O que melhor descreve você?</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["clipador", "Clipador / cortes"],
                ["creator", "Criador de conteúdo"],
                ["agencia", "Agência / social media"],
                ["outro", "Outro"],
              ].map(([v, l]) => (
                <button key={v} onClick={() => setRole(v)} className={cn("rounded-lg border px-3 py-2 text-left text-sm", role === v && "border-primary bg-primary/10")}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Qual seu principal objetivo com cortes?</Label>
            <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ex: crescer meu canal, participar de campeonatos…" />
          </div>
          <Button className="w-full" onClick={submit} loading={loading}>
            Enviar e ganhar 60 créditos
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BlankProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [name, setName] = useState("");
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Projeto do Zero</DialogTitle>
          <DialogDescription>Dê um nome para seu novo projeto e comece a criar vídeos personalizados</DialogDescription>
        </DialogHeader>
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Coleção de férias…" />
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={() => {
              onOpenChange(false);
              router.push(`/criar-projeto?title=${encodeURIComponent(name.trim())}`);
            }}
          >
            Criar Projeto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
