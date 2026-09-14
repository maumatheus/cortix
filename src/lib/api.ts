import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError, getCurrentUser } from "./auth";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

type Handler<T = unknown> = (ctx: { req: Request; params: Record<string, string>; user: Awaited<ReturnType<typeof getCurrentUser>> }) => Promise<T>;

/** Envolve um handler de rota com autenticação obrigatória e tratamento de erros. */
type RouteCtx = { params: Promise<Record<string, string>> };

export function withUser(handler: Handler<Response>) {
  return async (req: Request, ctx: RouteCtx) => {
    try {
      const user = await getCurrentUser();
      if (!user) throw new AuthError();
      const params = ctx?.params ? await ctx.params : {};
      return await handler({ req, params: params || {}, user });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function withHandler(handler: Handler<Response>) {
  return async (req: Request, ctx: RouteCtx) => {
    try {
      const user = await getCurrentUser();
      const params = ctx?.params ? await ctx.params : {};
      return await handler({ req, params: params || {}, user });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof ZodError) {
    return fail(e.issues.map((i) => i.message).join("; "), 422);
  }
  const err = e as Error & { status?: number };
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status === 500) console.error("[api]", err);
  return fail(err.message || "Erro interno", status);
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}
