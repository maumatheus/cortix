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
  connection?: "simulated" | "oauth" | "uploadpost";
  createdAt: string;
  postsCount?: number;
}

interface UploadPostIntegration {
  configured: boolean;
  fromEnv: boolean;
  hint: string | null;
}

/** Abre a página do Upload-Post (navegador) e fica sincronizando as contas conectadas lá. */
export async function startUploadPostConnect(onConnected: () => void) {
  const { url } = await api<{ url: string }>("/api/v1/social-accounts/uploadpost/connect");
  window.open(url, "_blank", "noopener");
  toast.info("Conecte o TikTok/Instagram/YouTube na página do Upload-Post. As contas aparecem aqui sozinhas.");
  let n = 0;
  const t = setInterval(async () => {
    await api("/api/v1/social-accounts/uploadpost/sync", { method: "POST" }).catch(() => {});
    onConnected();
    if (++n >= 60) clearInterval(t); // ~5 min
  }, 5000);
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
  const [up, setUp] = useState<UploadPostIntegration | null>(null);
  const [upKey, setUpKey] = useState("");
  const [upCfgOpen, setUpCfgOpen] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const oauth = purpose === "publish" && platform === "youtube";
  const viaUploadPost = purpose === "publish" && platform !== "youtube" && !simulated;

  useEffect(() => {
    if (open) {
      setHandle("");
      setPlatform("youtube");
      setCfgOpen(false);
      setUpCfgOpen(false);
      setSimulated(false);
      if (purpose === "publish") {
        api<YoutubeIntegration>("/api/v1/integrations/youtube").then(setYt).catch(() => setYt(null));
        api<UploadPostIntegration>("/api/v1/integrations/uploadpost").then(setUp).catch(() => setUp(null));
      }
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

  async function saveUpKey() {
    setLoading(true);
    try {
      await api("/api/v1/integrations/uploadpost", { method: "PUT", json: { apiKey: upKey.trim() } });
      setUp(await api<UploadPostIntegration>("/api/v1/integrations/uploadpost"));
      setUpCfgOpen(false);
      setUpKey("");
      toast.success("API key do Upload-Post salva");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function connectUploadPost() {
    setLoading(true);
    try {
      await startUploadPostConnect(onConnected);
      onOpenChange(false);
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
  const showUpConfig = viaUploadPost && (upCfgOpen || !up?.configured);

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
          {viaUploadPost ? (
            <UploadPostBox up={up} showConfig={showUpConfig} onEditConfig={() => setUpCfgOpen(true)} apiKey={upKey} setApiKey={setUpKey} onSimulated={() => setSimulated(true)} />
          ) : oauth ? (
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
                      <span className="font-semibold text-foreground">Conexão simulada.</span> A conta é registrada só pelo @ pra você organizar agendamentos e launchers; na hora marcada o post é apenas marcado como publicado, nada sobe pra rede.
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
          {viaUploadPost ? (
            showUpConfig ? (
              <Button onClick={saveUpKey} loading={loading} disabled={upKey.trim().length < 20}>
                <KeyRound /> Salvar API key
              </Button>
            ) : (
              <Button onClick={connectUploadPost} loading={loading} disabled={!up}>
                <ExternalLink /> Conectar TikTok / Instagram
              </Button>
            )
          ) : !oauth ? (
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

function UploadPostBox(p: { up: UploadPostIntegration | null; showConfig: boolean; onEditConfig: () => void; apiKey: string; setApiKey: (v: string) => void; onSimulated: () => void }) {
  const { up } = p;
  const simulatedLink = (
    <button type="button" className="text-[11px] text-muted-foreground underline hover:text-foreground" onClick={p.onSimulated}>
      Só registrar o @ (simulado, não publica)
    </button>
  );
  if (!up) return <p className="text-xs text-muted-foreground">Carregando integração…</p>;
  if (!p.showConfig) {
    return (
      <div className="space-y-2">
        <div className="flex gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
          <p>
            <span className="font-semibold text-foreground">Publicação real via Upload-Post.</span> Abre a página deles no navegador: conecte o TikTok e/ou o Instagram lá e volte. Os cortes agendados sobem sozinhos na hora marcada (com o Cortix aberto).
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {!up.fromEnv ? (
            <button type="button" className="text-[11px] text-muted-foreground underline hover:text-foreground" onClick={p.onEditConfig}>
              Trocar API key ({up.hint})
            </button>
          ) : null}
          {simulatedLink}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="rounded-xl border px-4 py-3 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">TikTok e Instagram via Upload-Post</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-4">
          <li>
            Crie a conta em{" "}
            <a className="text-primary underline" href="https://app.upload-post.com" target="_blank" rel="noreferrer">
              app.upload-post.com
            </a>{" "}
            (grátis: 10 envios/mês; ilimitado a partir de US$ 16/mês).
          </li>
          <li>Em API Keys, gere uma chave e cole abaixo.</li>
        </ol>
      </div>
      <div>
        <Label>API key</Label>
        <Input value={p.apiKey} onChange={(e) => p.setApiKey(e.target.value)} placeholder="eyJhbGciOi…" type="password" className="mt-1" />
      </div>
      {simulatedLink}
    </div>
  );
}
