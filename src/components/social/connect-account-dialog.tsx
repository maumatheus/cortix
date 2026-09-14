"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
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
  createdAt: string;
  postsCount?: number;
}

export function ConnectAccountDialog({ open, onOpenChange, purpose = "publish", onConnected }: { open: boolean; onOpenChange: (v: boolean) => void; purpose?: "publish" | "championship"; onConnected: () => void }) {
  const [platform, setPlatform] = useState<PlatformId>("youtube");
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setHandle("");
      setPlatform("youtube");
    }
  }, [open]);

  async function connect() {
    if (!handle.trim()) return toast.error("Informe o @ da conta");
    setLoading(true);
    try {
      await api("/api/v1/social-accounts", { method: "POST", json: { platform, handle: handle.trim(), purpose } });
      toast.success("Conta conectada (simulação)");
      onOpenChange(false);
      onConnected();
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
          <DialogTitle>Conectar conta</DialogTitle>
          <DialogDescription>{purpose === "publish" ? "Escolha a rede e informe o @ da conta que vai receber seus cortes." : "Conta usada só pra validar suas participações em campeonatos."}</DialogDescription>
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
          <div>
            <Label>@ da conta</Label>
            <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@seucanal" className="mt-1" autoFocus onKeyDown={(e) => e.key === "Enter" && connect()} />
          </div>
          <div className="flex gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 px-4 py-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-sky-400" />
            <p>
              <span className="font-semibold text-foreground">Conexão simulada.</span> Nesta versão o Cortix não abre o login oficial da rede (OAuth). A conta é registrada pelo @ pra você organizar agendamentos e launchers; a publicação real acontece quando a integração oficial for liberada.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={connect} loading={loading}>
            Conectar {PLATFORMS.find((p) => p.id === platform)?.name}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
