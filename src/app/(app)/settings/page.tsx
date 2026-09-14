"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, KeyRound, Languages, LogOut, Save, SunMoon, Trophy, User } from "lucide-react";
import { toast } from "sonner";
import { api, setUserCache, useUser } from "@/lib/hooks";
import type { PublicUser } from "@/lib/auth";
import { getPlan } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/progress";
import { Page } from "@/components/page-header";

export default function SettingsPage() {
  const router = useRouter();
  const { user, refresh } = useUser();
  const [name, setName] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [locale, setLocale] = useState<"pt-BR" | "en">("pt-BR");
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (user && !loaded) {
      setName(user.name);
      setPixKey(user.pixKey ?? "");
      setTheme(user.theme === "light" ? "light" : "dark");
      setLocale(user.locale === "en" ? "en" : "pt-BR");
      setLoaded(true);
    }
  }, [user, loaded]);

  const dirty = !!user && (name.trim() !== user.name || (pixKey.trim() || null) !== (user.pixKey || null) || theme !== user.theme || locale !== user.locale);

  async function save() {
    if (name.trim().length < 2) return toast.error("Informe um nome com pelo menos 2 caracteres");
    setSaving(true);
    try {
      const res = await api<{ user: PublicUser }>("/api/v1/user", {
        method: "PATCH",
        json: { name: name.trim(), pixKey: pixKey.trim() || null, theme, locale },
      });
      setUserCache(res.user);
      document.documentElement.classList.toggle("dark", res.user.theme !== "light");
      toast.success("Configurações salvas");
    } catch (e) {
      toast.error((e as Error).message);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    setLeaving(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      setUserCache(null);
      router.push("/login");
    } catch (e) {
      toast.error((e as Error).message);
      setLeaving(false);
    }
  }

  const plan = getPlan(user?.plan);

  return (
    <Page>
      <p className="eyebrow flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-success" /> Conta · Configurações
      </p>
      <h1 className="display mt-3 text-4xl md:text-5xl">
        Sua conta, <span className="text-primary">do seu jeito.</span>
      </h1>

      {!user ? (
        <Skeleton className="mt-8 h-64 w-full" />
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <User className="size-4" />
                </span>
                <div>
                  <p className="font-semibold">Perfil</p>
                  <p className="text-xs text-muted-foreground">Como você aparece na comunidade e nos campeonatos.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Nome</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" maxLength={80} />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input value={user.email} readOnly disabled className="mt-1" />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-success/15 text-success">
                  <KeyRound className="size-4" />
                </span>
                <div>
                  <p className="font-semibold">Chave PIX</p>
                  <p className="text-xs text-muted-foreground">Necessária para receber prêmios de campeonatos.</p>
                </div>
              </div>
              <div className="mt-5">
                <Label>Chave PIX (CPF, e-mail, telefone ou aleatória)</Label>
                <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="Ex: seu@email.com" className="mt-1 font-mono" maxLength={120} />
                <p className="mt-2 text-[11px] text-muted-foreground">Os pagamentos de premiação são feitos exclusivamente por PIX para a chave cadastrada aqui, em nome do titular da conta.</p>
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                  <SunMoon className="size-4" />
                </span>
                <div>
                  <p className="font-semibold">Preferências</p>
                  <p className="text-xs text-muted-foreground">Tema e idioma da interface.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="flex items-center gap-1.5">
                    <SunMoon className="size-3.5" /> Tema
                  </Label>
                  <NativeSelect value={theme} onChange={(e) => setTheme(e.target.value as "dark" | "light")} className="mt-1 w-full">
                    <option value="dark">Escuro</option>
                    <option value="light">Claro</option>
                  </NativeSelect>
                </div>
                <div>
                  <Label className="flex items-center gap-1.5">
                    <Languages className="size-3.5" /> Idioma
                  </Label>
                  <NativeSelect value={locale} onChange={(e) => setLocale(e.target.value as "pt-BR" | "en")} className="mt-1 w-full">
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en">English</option>
                  </NativeSelect>
                </div>
              </div>
            </section>

            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" disabled={!dirty || saving} onClick={() => setLoaded(false)}>
                Descartar
              </Button>
              <Button onClick={save} loading={saving} disabled={!dirty}>
                <Save /> Salvar alterações
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border bg-card p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Trophy className="size-4" />
                  </span>
                  <p className="font-semibold">Seu plano</p>
                </div>
                {user.isSubscriber ? <Badge variant="success">Ativo</Badge> : <Badge variant="secondary">Gratuito</Badge>}
              </div>
              {user.isSubscriber && plan ? (
                <dl className="mt-5 space-y-2 text-sm">
                  <Row k="Plano" v={`Plano ${plan.name}`} />
                  <Row k="Ciclo" v={user.planCycle === "yearly" ? "Anual" : "Mensal"} />
                  <Row k="Renova em" v={user.planRenewsAt ? new Date(user.planRenewsAt).toLocaleDateString("pt-BR") : "—"} />
                  <Row k="Créditos por mês" v={plan.credits.toLocaleString("pt-BR")} />
                  <Row k="Saldo atual" v={`${user.credits.toLocaleString("pt-BR")} créditos`} />
                </dl>
              ) : (
                <div className="mt-5">
                  <p className="text-sm text-muted-foreground">Você está no plano gratuito, com {user.freeClipsLeft} cortes de teste restantes e {user.credits} créditos.</p>
                </div>
              )}
              <Button asChild variant="outline" className="mt-5 w-full">
                <Link href="/financeiro?tab=plans">
                  {user.isSubscriber ? "Gerenciar plano" : "Ver planos"} <ArrowRight />
                </Link>
              </Button>
            </section>

            <section className="rounded-2xl border bg-card p-6">
              <p className="font-semibold">Código de convite</p>
              <p className="mt-1 text-xs text-muted-foreground">Compartilhe para ganhar créditos quando um amigo fizer a primeira compra.</p>
              <div className="mt-3 flex items-center justify-between rounded-xl border bg-background/40 px-3 py-2">
                <span className="font-mono font-bold text-primary">{user.referralCode}</span>
                <Link href="/convidar" className="text-xs text-primary hover:underline">
                  Personalizar
                </Link>
              </div>
            </section>

            <section className="rounded-2xl border border-destructive/30 bg-card p-6">
              <p className="font-semibold">Sessão</p>
              <p className="mt-1 text-xs text-muted-foreground">Encerre sua sessão neste dispositivo.</p>
              <Button variant="destructive" className="mt-4 w-full" onClick={logout} loading={leaving}>
                <LogOut /> Sair
              </Button>
            </section>
          </div>
        </div>
      )}
    </Page>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
