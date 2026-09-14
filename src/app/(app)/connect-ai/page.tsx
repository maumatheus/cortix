"use client";

import { useEffect, useState } from "react";
import { Bot, Check, Code2, Copy, Sparkles, Terminal, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Page } from "@/components/page-header";
import { TokenPanel } from "@/components/connect-ai/token-panel";

interface AppDef {
  id: string;
  name: string;
  sub: string;
  icon: React.ElementType;
  steps: (mcpUrl: string) => Array<{ text: string; code?: string }>;
}

const APPS: AppDef[] = [
  {
    id: "claude",
    name: "Claude",
    sub: "Web, desktop e celular",
    icon: Sparkles,
    steps: (u) => [
      { text: "No Claude, abra Customize › Connectors." },
      { text: "Clique em + Add custom connector e cole a URL do servidor:", code: u },
      { text: "Cole seu token de acesso no campo de autenticação (Bearer token) e salve." },
      { text: "Numa conversa nova, ative o conector Cortix e peça: \"liste meus projetos\"." },
    ],
  },
  {
    id: "claude-code",
    name: "Claude Code",
    sub: "Terminal",
    icon: Terminal,
    steps: (u) => [
      { text: "No terminal, adicione o servidor MCP com o seu token:", code: `claude mcp add --transport http Cortix ${u} --header "Authorization: Bearer SEU_TOKEN"` },
      { text: "Abra o Claude Code e confira com /mcp se o Cortix aparece conectado." },
      { text: "Peça direto no chat: \"crie cortes desse vídeo: <link>\"." },
    ],
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    sub: "Plus, Pro, Business, Enterprise",
    icon: Bot,
    steps: (u) => [
      { text: "Em Settings › Connectors (ou Apps), ative o Developer mode." },
      { text: "Clique em Create e informe a URL do servidor MCP:", code: u },
      { text: "Em autenticação escolha \"Custom header\" e informe Authorization: Bearer SEU_TOKEN." },
      { text: "Inicie um chat com o conector Cortix habilitado." },
    ],
  },
  {
    id: "cursor",
    name: "Cursor",
    sub: "Editor de código",
    icon: Code2,
    steps: (u) => [
      { text: "Abra Settings › MCP › Add new MCP server." },
      { text: "Cole a configuração (troque SEU_TOKEN):", code: `{\n  "mcpServers": {\n    "Cortix": {\n      "url": "${u}",\n      "headers": { "Authorization": "Bearer SEU_TOKEN" }\n    }\n  }\n}` },
      { text: "Confirme que o servidor aparece verde e use o Agent mode." },
    ],
  },
  {
    id: "vscode",
    name: "VS Code / Copilot",
    sub: "GitHub Copilot",
    icon: Code2,
    steps: (u) => [
      { text: "Crie ou edite .vscode/mcp.json no seu workspace:", code: `{\n  "servers": {\n    "Cortix": {\n      "type": "http",\n      "url": "${u}",\n      "headers": { "Authorization": "Bearer SEU_TOKEN" }\n    }\n  }\n}` },
      { text: "Clique em Start acima do servidor e abra o Copilot Chat em modo Agent." },
    ],
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    sub: "Terminal",
    icon: Terminal,
    steps: (u) => [
      { text: "Edite ~/.gemini/settings.json e adicione:", code: `{\n  "mcpServers": {\n    "Cortix": {\n      "httpUrl": "${u}",\n      "headers": { "Authorization": "Bearer SEU_TOKEN" }\n    }\n  }\n}` },
      { text: "Reinicie o Gemini CLI e rode /mcp pra conferir as ferramentas." },
    ],
  },
  {
    id: "other",
    name: "Outros",
    sub: "Windsurf, mcp-remote e mais",
    icon: Wand2,
    steps: (u) => [
      { text: "O Cortix é um servidor MCP padrão (Streamable HTTP, JSON-RPC 2.0). Use esta URL em qualquer cliente compatível:", code: u },
      { text: "Se o app só aceita servidores locais (stdio), use o mcp-remote:", code: `npx -y mcp-remote ${u} --header "Authorization: Bearer SEU_TOKEN"` },
      { text: "Ferramentas expostas: list_projects, get_project, create_project, render_short e get_balance." },
    ],
  },
];

const EXAMPLES = [
  "Liste meus projetos mais recentes e me diga quais já estão prontos.",
  "Crie cortes desse vídeo: https://www.youtube.com/watch?v=XXXX com clipes de 60 segundos.",
  "Mostre os cortes do projeto X ordenados pela nota e renderize os 3 melhores.",
  "Quantos créditos eu ainda tenho e qual é o meu plano?",
  "Analise só do minuto 10 ao 40 desse podcast e gere os melhores momentos.",
];

export default function ConnectAiPage() {
  const [app, setApp] = useState(APPS[0].id);
  const [origin, setOrigin] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const mcpUrl = `${origin || "https://SEU_DOMINIO"}/api/mcp`;
  const current = APPS.find((a) => a.id === app) ?? APPS[0];

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(key);
      toast.success("Copiado");
      setTimeout(() => setCopiedIdx((k) => (k === key ? null : k)), 1500);
    });
  }

  return (
    <Page wide>
      <div className="max-w-2xl">
        <p className="eyebrow flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-success" /> Mais · Integrações
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Conecte uma IA ao Cortix</h1>
        <p className="mt-3 text-sm text-muted-foreground">Claude, ChatGPT, Cursor e outros assistentes passam a criar cortes e consultar seus projetos direto no chat. Escolha o app e siga os passos.</p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {APPS.map((a) => (
              <button key={a.id} onClick={() => setApp(a.id)} className={cn("flex flex-col gap-2 rounded-2xl border p-4 text-left transition", app === a.id ? "border-primary bg-primary/10" : "bg-card hover:bg-secondary/50")}>
                <span className={cn("flex size-9 items-center justify-center rounded-lg", app === a.id ? "bg-primary text-white" : "bg-secondary text-muted-foreground")}>
                  <a.icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{a.name}</span>
                  <span className="block text-[11px] text-muted-foreground">{a.sub}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <current.icon className="size-4 text-primary" />
              <p className="font-semibold">Como conectar no {current.name}</p>
            </div>
            <ol className="mt-4 space-y-4">
              {current.steps(mcpUrl).map((s, i) => {
                const key = `${current.id}-${i}`;
                return (
                  <li key={key} className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] font-bold text-primary">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{s.text}</p>
                      {s.code ? (
                        <div className="relative mt-2">
                          <pre className="scrollbar-thin overflow-x-auto rounded-lg border bg-background px-3 py-2 pr-10 font-mono text-[11px] leading-relaxed">{s.code}</pre>
                          <button onClick={() => copy(s.code!, key)} className="absolute right-2 top-2 rounded-md border bg-card p-1 text-muted-foreground hover:text-foreground" title="Copiar">
                            {copiedIdx === key ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 rounded-lg bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground">
              URL do servidor: <span className="font-mono text-foreground">{mcpUrl}</span> · Autenticação: header <span className="font-mono text-foreground">Authorization: Bearer &lt;token&gt;</span>
            </p>
          </div>

          <div className="mt-6 rounded-2xl border bg-card p-5">
            <p className="eyebrow">O que você pode pedir</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {EXAMPLES.map((ex, i) => {
                const key = `ex-${i}`;
                return (
                  <button key={key} onClick={() => copy(ex, key)} className="group flex items-start gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition hover:border-primary/60 hover:bg-primary/5">
                    <span className="mt-0.5 shrink-0 text-muted-foreground group-hover:text-primary">{copiedIdx === key ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}</span>
                    <span className="text-xs leading-relaxed">&ldquo;{ex}&rdquo;</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <TokenPanel />
      </div>
    </Page>
  );
}
