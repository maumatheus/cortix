"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api, setUserCache } from "@/lib/hooks";
import type { PublicUser } from "@/lib/auth";
import { Button } from "./ui/button";
import { Input, Label } from "./ui/input";
import { Logo } from "./app-shell";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const ref = sp.get("ref") || "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const d = await api<{ user: PublicUser }>(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        json: mode === "login" ? { email, password } : { name, email, password, ref: ref || undefined },
      });
      setUserCache(d.user);
      router.push("/dashboard");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.25),transparent_55%)] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo className="text-xl" />
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-2xl">
          <h1 className="display text-3xl">{mode === "login" ? "Bem-vindo de volta." : "Seu primeiro corte começa aqui."}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login" ? "Entre para continuar criando cortes virais." : "Crie sua conta e ganhe 3 cortes grátis para testar."}
          </p>
          {ref && mode === "register" ? <p className="mt-3 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">Você foi convidado com o código {ref}. Vocês dois ganham créditos na sua primeira compra.</p> : null}
          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "register" ? (
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>{mode === "login" ? "Usuário ou e-mail" : "E-mail"}</Label>
              <Input type={mode === "login" ? "text" : "email"} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={mode === "login" ? "admin ou voce@email.com" : "voce@email.com"} autoCapitalize="none" required />
            </div>
            <div className="space-y-1.5">
              <Label>Senha</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={mode === "register" ? 6 : 1} />
            </div>
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              {mode === "login" ? "Entrar" : "Criar conta grátis"}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                Ainda não tem conta?{" "}
                <Link href={`/register${ref ? `?ref=${ref}` : ""}`} className="font-semibold text-primary hover:underline">
                  Cadastre-se
                </Link>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <Link href="/login" className="font-semibold text-primary hover:underline">
                  Entrar
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
