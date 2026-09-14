"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicUser } from "./auth";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  let body = init?.body;
  if (init?.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  const res = await fetch(url, { ...init, headers, body, credentials: "same-origin" });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data as { error?: string })?.error || res.statusText || "Erro";
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

export function useFetch<T>(url: string | null, opts: { refreshMs?: number; enabled?: boolean } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const urlRef = useRef(url);
  urlRef.current = url;

  const reload = useCallback(async () => {
    const u = urlRef.current;
    if (!u) return;
    try {
      const d = await api<T>(u);
      setData(d);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!url || opts.enabled === false) return;
    setLoading(true);
    reload();
    if (opts.refreshMs) {
      const t = setInterval(reload, opts.refreshMs);
      return () => clearInterval(t);
    }
  }, [url, opts.refreshMs, opts.enabled, reload]);

  return { data, error, loading, reload, setData };
}

let userCache: PublicUser | null = null;
const listeners = new Set<(u: PublicUser | null) => void>();

export function setUserCache(u: PublicUser | null) {
  userCache = u;
  listeners.forEach((l) => l(u));
}

export function useUser() {
  const [user, setUser] = useState<PublicUser | null>(userCache);
  const [loading, setLoading] = useState(!userCache);
  useEffect(() => {
    listeners.add(setUser);
    if (!userCache) {
      api<{ user: PublicUser }>("/api/auth/me")
        .then((d) => setUserCache(d.user))
        .catch(() => setUserCache(null))
        .finally(() => setLoading(false));
    } else setLoading(false);
    return () => {
      listeners.delete(setUser);
    };
  }, []);
  const refresh = useCallback(async () => {
    try {
      const d = await api<{ user: PublicUser }>("/api/auth/me");
      setUserCache(d.user);
      return d.user;
    } catch {
      return null;
    }
  }, []);
  return { user, loading, refresh };
}
