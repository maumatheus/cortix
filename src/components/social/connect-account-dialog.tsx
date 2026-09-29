"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Info, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PLATFORMS, PlatformDot, type PlatformId } from "@/components/shared/platform";

export interface SocialAccountItem {
  id: string;
  platform: PlatformId;
  handle: string;
  purpose: "publish" | "championship";
  connection?: "simulated" | "oauth";
  createdAt: string;
  postsCount?: number;
}

interface YoutubeIntegration {
  configured: boolean;
  fromEnv: boolean;
  clientId: string | null;
  redirectUri: string;
}

/** Abre o login do Google (no app desktop vai pro navegador do sistema) e fica recarregando a lista de contas. */
export async function startYoutubeOAuth(onConnected: () => void, reconnect = false) {
  const { url } = await api<{ url: string }>(`/api/v1/social-accounts/oauth/youtube${reconnect ? "?reconnect=1" : ""}`);
  window.open(url, "_blank", "noopener");
  toast.info("Finalize o login do Google no navegador. A conta aparece aqui sozinha.");
  let n = 0;
  const t = setInterval(() => {
    onConnected();
    if (++n >= 40) clearInterval(t); // ~2 min
  }, 3000);
}

export function ConnectAccountDialog({ open, onOpenChange, purpose = "publish", onConnected }: { open: boolean; onOpenChange: (v: boolean) => void; purpose?: "publish" | "championship"; onConnected: () => void }) {
  const [platform, setPlatform] = useState<PlatformId>("youtube");
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(false);
  const [yt, setYt] = useState<YoutubeIntegration | null>(null);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const oauth = purpose === "publish" && platform === "youtube";

  useEffect(() => {
    if (open) {
      setHandle("");
      setPlatform("youtube");
      setCfgOpen(false);
      if (purpose === "publish") api<YoutubeIntegration>("/api/v1/integrations/youtube").then(setYt).catch(() => setYt(null));
    }
  }, [open, purpose]);

  async function connect() {
    if (!handle.trim()) return toast.error("Informe o @ da conta");
    setLoading(true);
    try {
      await api("/api/v1/social-accounts", { method: "POST", json: { platform, handle: handle.trim(), purpose } });
      toast.success(purpose === "publish" ? "Conta conectada (simulação)" : "Conta conectada");
      onOpenChange(false);
      onConnected();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    setLoading(true);
    try {
      await api("/api/v1/integrations/youtube", { method: "PUT", json: { clientId: clientId.trim(), clientSecret: clientSecret.trim() } });
      setYt(await api<YoutubeIntegration>("/api/v1/integrations/youtube"));
      setCfgOpen(false);
      setClientId("");
      setClientSecret("");
      toast.success("Credenciais do Google salvas");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function connectGoogle() {
    setLoading(true);
    try {
      await startYoutubeOAuth(onConnected);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const showConfig = oauth && (cfgOpen || !yt?.configured);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conectar conta</DialogTitle>
          <DialogDescription>{purpose === "publish" ? "Escolha a rede da conta que vai receber seus cortes." : "Conta usada só pra validar suas participações em campeonatos."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Rede social</Label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {PLATFORMS.map((p) => (
                <button key={p.id} type="button" onClick={() => setPlatform(p.id)} className={cn("flex flex-col items-center gap-2 rounded-xl border p-3 text-sm font-semibold transition", platform === p.id ? "border-primary bg-primary/10" : "hover:bg-secondary/60")}>
                  <PlatformDot platform={p.id} size="lg" />
                  {p.name}
                  <span className="text-[10px] font-normal text-muted-foreground">{p.hint}</span>
                </button>
              ))}
            </div>
          </div>
          {oauth ? (
            <YoutubeOAuthBox yt={yt} showConfig={showConfig} onEditConfig={() => setCfgOpen(true)} clientId={clientId} setClientId={setClientId} clientSecret={clientSecret} setClientSecret={setClientSecret} />
          ) : (
            <>
              <div>
                <Label>@ da conta</Label>
                <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@seucanal" className="mt-1" autoFocus onKeyDown={(e) => e.key === "Enter" && connect()} />
              </div>
              <div className="flex gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 px-4 py-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0 text-sky-400" />
                <p>
                  {purpose === "publish" ? (
                    <>
                      <span className="font-semibold text-foreground">Conexão simulada.</span> A publicação real no TikTok e no Instagram ainda não foi liberada. A conta é registrada pelo @ pra você organizar agendamentos e launchers; na hora marcada o post só é marcado como publicado.
                    </>
                  ) : (
                    "A conta é registrada pelo @ para validar suas participações."
                  )}
                </p>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {!oauth ? (
            <Button onClick={connect} loading={loading}>
              Conectar {PLATFORMS.find((p) => p.id === platform)?.name}
            </Button>
          ) : showConfig ? (
            <Button onClick={saveConfig} loading={loading} disabled={!clientId.trim() || !clientSecret.trim()}>
              <KeyRound /> Salvar credenciais
            </Button>
          ) : (
            <Button onClick={connectGoogle} loading={loading} disabled={!yt}>
              <ExternalLink /> Entrar com Google
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function YoutubeOAuthBox(p: {
  yt: YoutubeIntegration | null;
  showConfig: boolean;
  onEditConfig: () => void;
  clientId: string;
  setClientId: (v: string) => void;
  clientSecret: string;
  setClientSecret: (v: string) => void;
}) {
  const { yt } = p;
  if (!yt) return <p className="text-xs text-muted-foreground">Carregando integração…</p>;
  if (!p.showConfig) {
    return (
      <div className="space-y-2">
        <div className="flex gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
          <p>
            <span className="font-semibold text-foreground">Publicação real.</span> O login do Google abre no navegador. Depois de autorizar, os cortes agendados nesse canal sobem sozinhos como Shorts na hora marcada (com o Cortix aberto).
          </p>
        </div>
        {!yt.fromEnv ? (
          <button type="button" className="text-[11px] text-muted-foreground underline hover:text-foreground" onClick={p.onEditConfig}>
            Trocar credenciais do Google ({yt.clientId})
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="rounded-xl border px-4 py-3 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Configuração única (grátis)</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-4">
          <li>
            No{" "}
            <a className="text-primary underline" href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer">
              Google Cloud
            </a>
            , crie um projeto e ative a <b>YouTube Data API v3</b>.
          </li>
          <li>Em &quot;Tela de consentimento OAuth&quot;: tipo Externo, e seu e-mail em Usuários de teste.</li>
          <li>
            Em Credenciais → Criar ID do cliente OAuth → tipo <b>App para computador</b>.
          </li>
          <li>Cole abaixo o Client ID e o Client Secret.</li>
        </ol>
        <p className="mt-2 break-all">Redirect usado: {yt.redirectUri}</p>
      </div>
      <div>
        <Label>Client ID</Label>
        <Input value={p.clientId} onChange={(e) => p.setClientId(e.target.value)} placeholder="1234-abc.apps.googleusercontent.com" className="mt-1" />
      </div>
      <div>
        <Label>Client Secret</Label>
        <Input value={p.clientSecret} onChange={(e) => p.setClientSecret(e.target.value)} placeholder="GOCSPX-…" type="password" className="mt-1" />
      </div>
    </div>
  );
}
