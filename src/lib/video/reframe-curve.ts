/**
 * Curva da câmera virtual do reenquadramento (sem dependências de Node: usada no render e na prévia do editor).
 * A análise (detecção de rosto + cenas) fica em ./reframe.ts.
 */

export const PAN_SEC = 0.6;

export interface ReframeKey {
  t: number; // segundo absoluto do vídeo
  x: number; // centro horizontal do recorte, 0..1 da largura
  cut: boolean; // true = salto seco (troca de cena); false = pan suave
}

export interface ReframeData {
  v: 1;
  start: number;
  end: number;
  keys: ReframeKey[];
  faces: number; // frames com rosto (0 = ficou no centro)
}

export const TRACKED_LAYOUTS = new Set(["single", "single-clean"]);

/** Centro do recorte num instante (mesma curva do ffmpeg; usada na prévia do editor). */
export function reframeXAt(data: ReframeData | null | undefined, t: number): number {
  if (!data?.keys.length) return 0.5;
  const ks = data.keys;
  let i = 0;
  while (i + 1 < ks.length && ks[i + 1].t <= t) i++;
  const k = ks[i];
  if (t < k.t) return ks[0].x;
  if (k.cut || i === 0) return k.x;
  const prev = ks[i - 1].x;
  const p = Math.min(1, (t - k.t) / PAN_SEC);
  const e = p * p * (3 - 2 * p); // smoothstep
  return prev + (k.x - prev) * e;
}

/**
 * Expressão (0..1) do centro do recorte para o ffmpeg. `t` no filtro começa em 0 no início do corte
 * (-ss antes do -i), então as chaves absolutas são deslocadas por clipStart.
 */
export function reframeCenterExpr(data: ReframeData, clipStart: number): string {
  const ks = data.keys.map((k) => ({ ...k, t: Math.max(0, k.t - clipStart) }));
  const f = (n: number) => n.toFixed(4);
  const seg = (i: number) => {
    const k = ks[i];
    if (k.cut || i === 0) return f(k.x);
    const prev = ks[i - 1].x;
    const p = `min(1,(t-${f(k.t)})/${PAN_SEC})`;
    return `if(lt(t,${f(k.t + PAN_SEC)}),${f(prev)}+(${f(k.x - prev)})*${p}*${p}*(3-2*${p}),${f(k.x)})`;
  };
  let e = seg(ks.length - 1);
  for (let i = ks.length - 2; i >= 0; i--) e = `if(lt(t,${f(ks[i + 1].t)}),${seg(i)},${e})`;
  return e;
}

/** crop 9:16 da altura cheia, com x seguindo a câmera virtual (substitui o crop central). */
export function trackedCrop(data: ReframeData, clipStart: number, cropH = "ih") {
  return `crop=${cropH}*9/16:${cropH}:x='max(0,min(iw-ow,(${reframeCenterExpr(data, clipStart)})*iw-ow/2))':y=0`;
}
