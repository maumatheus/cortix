"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";

/* ---------- histórico (desfazer / refazer) ---------- */

export interface History<T> {
  state: T;
  /** Atualiza o estado. `push` (padrão) grava no histórico; `replace` não (útil durante arrastos). */
  update: (fn: (prev: T) => T, mode?: "push" | "replace") => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (next: T) => void;
  /** Grava o estado atual no histórico (chame no início de um arrasto; depois use `update(..., "replace")`). */
  snapshot: () => void;
}

const LIMIT = 100;

export function useHistory<T>(initial: T): History<T> {
  const [present, setPresent] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const presentRef = useRef(present);
  presentRef.current = present;
  const [, tick] = useState(0);

  const update = useCallback((fn: (prev: T) => T, mode: "push" | "replace" = "push") => {
    const prev = presentRef.current;
    const next = fn(prev);
    if (next === prev) return;
    if (mode === "push") {
      past.current.push(prev);
      if (past.current.length > LIMIT) past.current.shift();
      future.current = [];
    }
    presentRef.current = next;
    setPresent(next);
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (prev === undefined) return;
    future.current.push(presentRef.current);
    presentRef.current = prev;
    setPresent(prev);
    tick((n) => n + 1);
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next === undefined) return;
    past.current.push(presentRef.current);
    presentRef.current = next;
    setPresent(next);
    tick((n) => n + 1);
  }, []);

  const reset = useCallback((next: T) => {
    past.current = [];
    future.current = [];
    presentRef.current = next;
    setPresent(next);
    tick((n) => n + 1);
  }, []);

  const snapshot = useCallback(() => {
    past.current.push(presentRef.current);
    if (past.current.length > LIMIT) past.current.shift();
    future.current = [];
    tick((n) => n + 1);
  }, []);

  return { state: present, update, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0, reset, snapshot };
}

/* ---------- store de tempo (evita re-render do editor inteiro a cada frame) ---------- */

export interface TimeStore {
  get: () => number;
  set: (t: number) => void;
  subscribe: (fn: () => void) => () => void;
}

export function createTimeStore(initial = 0): TimeStore {
  let t = initial;
  const subs = new Set<() => void>();
  return {
    get: () => t,
    set: (v) => {
      if (v === t) return;
      t = v;
      subs.forEach((f) => f());
    },
    subscribe: (fn) => {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
  };
}

/** Tempo absoluto atual (segundos no vídeo de origem). */
export function useTime(store: TimeStore) {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
