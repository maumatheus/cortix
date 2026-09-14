import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { callTool, ToolError, TOOLS } from "@/lib/mcp/tools";

export const runtime = "nodejs";

const PROTOCOL_VERSION = "2025-03-26";
const SERVER_INFO = { name: "Cortix", version: "1.0.0" };

type JsonRpcId = string | number | null;
interface JsonRpcRequest {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
}

function rpcError(id: JsonRpcId, code: number, message: string, status = 200, data?: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message, ...(data !== undefined ? { data } : {}) } }, { status });
}
function rpcResult(id: JsonRpcId, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

async function authenticate(req: Request) {
  const header = req.headers.get("authorization") || "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  const raw = m?.[1]?.trim() || new URL(req.url).searchParams.get("token") || "";
  if (!raw) return null;
  const t = await db.apiToken.findUnique({ where: { token: raw }, include: { user: true } });
  if (!t) return null;
  db.apiToken.update({ where: { id: t.id }, data: { lastUsedAt: new Date() } }).catch(() => null);
  return t.user;
}

async function handle(msg: JsonRpcRequest, req: Request): Promise<Response | null> {
  const id = msg.id ?? null;
  const method = msg.method || "";
  const params = msg.params || {};
  const isNotification = msg.id === undefined;

  if (!method) return rpcError(id, -32600, "Requisição inválida: método ausente", 400);

  // notificações não têm resposta
  if (isNotification || method.startsWith("notifications/")) return null;

  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false }, resources: {}, prompts: {} },
      serverInfo: SERVER_INFO,
      instructions: "Servidor MCP do Cortix. Use list_projects, get_project, create_project, render_short e get_balance. Responda em português.",
    });
  }
  if (method === "ping") return rpcResult(id, {});

  // tudo abaixo exige token
  const user = await authenticate(req);
  if (!user) return rpcError(id, -32001, "Não autenticado: envie o header Authorization: Bearer <token>. Gere um token em /connect-ai.", 401);

  switch (method) {
    case "tools/list":
      return rpcResult(id, { tools: TOOLS });
    case "resources/list":
      return rpcResult(id, { resources: [] });
    case "prompts/list":
      return rpcResult(id, { prompts: [] });
    case "tools/call": {
      const name = String(params.name || "");
      const args = (params.arguments && typeof params.arguments === "object" ? params.arguments : {}) as Record<string, unknown>;
      try {
        const result = await callTool(name, args, user);
        return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result, isError: false });
      } catch (e) {
        const err = e as Error & { code?: number };
        if (err instanceof ToolError && err.code === -32601) return rpcError(id, -32601, err.message);
        // erros de execução da ferramenta vão dentro do resultado (padrão MCP)
        return rpcResult(id, { content: [{ type: "text", text: err.message || "Erro ao executar a ferramenta" }], isError: true });
      }
    }
    default:
      return rpcError(id, -32601, `Método não suportado: ${method}`);
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "JSON inválido", 400);
  }
  if (Array.isArray(body)) {
    const responses: unknown[] = [];
    for (const m of body) {
      const r = await handle(m as JsonRpcRequest, req);
      if (r) responses.push(await r.json());
    }
    if (!responses.length) return new Response(null, { status: 202 });
    return NextResponse.json(responses);
  }
  if (!body || typeof body !== "object") return rpcError(null, -32600, "Requisição inválida", 400);
  const r = await handle(body as JsonRpcRequest, req);
  if (!r) return new Response(null, { status: 202 });
  return r;
}

export async function GET() {
  return NextResponse.json({ error: "Método não permitido. Este endpoint MCP aceita apenas POST (JSON-RPC 2.0, Streamable HTTP).", server: SERVER_INFO, protocolVersion: PROTOCOL_VERSION }, { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE() {
  return new Response(null, { status: 204 });
}
