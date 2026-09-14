"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTimeStore, type TimeStore } from "./stores";

export interface Player {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** ref de callback para o <video> principal (re-liga os eventos quando o layout troca o elemento) */
  setVideo: (el: HTMLVideoElement | null) => void;
  /** tempo absoluto (segundos no vídeo de origem) */
  time: TimeStore;
  playing: boolean;
  loop: boolean;
  setLoop: (v: boolean) => void;
  muted: boolean;
  setMuted: (v: boolean) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** seek absoluto, limitado ao intervalo do corte */
  seek: (t: number) => void;
  /** seek relativo ao início do corte */
  seekRel: (rel: number) => void;
  step: (delta: number) => void;
  /** registra vídeos secundários (layouts com mais de uma cópia) para manter em sincronia */
  attachSecondary: (el: HTMLVideoElement | null) => () => void;
  ready: boolean;
}

export function usePlayer(start: number, end: number): Player {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const setVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    setVideoEl(el);
  }, []);
  const time = useMemo(() => createTimeStore(start), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);
  const range = useRef({ start, end });
  range.current = { start, end };
  const loopRef = useRef(loop);
  loopRef.current = loop;
  const secondaries = useRef(new Set<HTMLVideoElement>());
  const raf = useRef(0);

  const syncSecondaries = useCallback((force = false) => {
    const v = videoRef.current;
    if (!v) return;
    secondaries.current.forEach((s) => {
      if (force || Math.abs(s.currentTime - v.currentTime) > 0.25) s.currentTime = v.currentTime;
    });
  }, []);

  const seek = useCallback(
    (t: number) => {
      const v = videoRef.current;
      const { start: s, end: e } = range.current;
      const clamped = Math.min(Math.max(t, s), e);
      time.set(clamped);
      if (v) {
        v.currentTime = clamped;
        syncSecondaries(true);
      }
    },
    [time, syncSecondaries],
  );

  const pause = useCallback(() => {
    videoRef.current?.pause();
    secondaries.current.forEach((s) => s.pause());
  }, []);

  const play = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const { start: s, end: e } = range.current;
    if (v.currentTime >= e - 0.05 || v.currentTime < s) {
      v.currentTime = s;
      time.set(s);
    }
    syncSecondaries(true);
    v.play().catch(() => {});
    secondaries.current.forEach((sec) => sec.play().catch(() => {}));
  }, [time, syncSecondaries]);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) play();
    else pause();
  }, [play, pause]);

  const seekRel = useCallback((rel: number) => seek(range.current.start + rel), [seek]);
  const step = useCallback(
    (delta: number) => {
      pause();
      seek(time.get() + delta);
    },
    [pause, seek, time],
  );

  // eventos do vídeo principal
  useEffect(() => {
    const v = videoEl;
    if (!v) {
      setPlaying(false);
      return;
    }
    v.muted = muted;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onLoaded = () => {
      setReady(true);
      const { start: s, end: e } = range.current;
      const target = Math.min(Math.max(time.get(), s), e);
      if (Math.abs(v.currentTime - target) > 0.05) v.currentTime = target;
      time.set(target);
      secondaries.current.forEach((sec) => {
        sec.currentTime = target;
      });
    };
    const onTime = () => {
      if (v.paused) time.set(v.currentTime);
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTime);
    if (v.readyState >= 1) onLoaded();
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTime);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoEl, time]);

  // laço de animação enquanto reproduz
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const v = videoRef.current;
      if (!v) return;
      const { start: s, end: e } = range.current;
      if (v.currentTime >= e) {
        if (loopRef.current) {
          v.currentTime = s;
          time.set(s);
          syncSecondaries(true);
        } else {
          v.pause();
          v.currentTime = e;
          time.set(e);
          return;
        }
      } else {
        time.set(v.currentTime);
        syncSecondaries();
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, time, syncSecondaries]);

  // se o intervalo mudou e o cursor ficou fora, reposiciona
  useEffect(() => {
    const t = time.get();
    if (t < start || t > end) seek(Math.min(Math.max(t, start), end));
  }, [start, end, seek, time]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = muted;
  }, [muted]);

  const attachSecondary = useCallback(
    (el: HTMLVideoElement | null) => {
      if (!el) return () => {};
      el.muted = true;
      secondaries.current.add(el);
      const v = videoRef.current;
      if (v) {
        el.currentTime = v.currentTime;
        if (!v.paused) el.play().catch(() => {});
      }
      return () => {
        secondaries.current.delete(el);
      };
    },
    [],
  );

  return useMemo<Player>(
    () => ({ videoRef, setVideo, time, playing, loop, setLoop, muted, setMuted, play, pause, toggle, seek, seekRel, step, attachSecondary, ready }),
    [setVideo, time, playing, loop, muted, play, pause, toggle, seek, seekRel, step, attachSecondary, ready],
  );
}
