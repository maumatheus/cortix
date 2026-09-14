export type PlanId = "lite" | "creator" | "viral";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyCents: number;
  yearlyCents: number; // per month when billed yearly
  credits: number; // per month
  hours: number;
  socials: number;
  popular?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "lite",
    name: "Lite",
    tagline: "Comece do jeito certo, sem gastar demais",
    monthlyCents: 5990,
    yearlyCents: 4790,
    credits: 1800,
    hours: 30,
    socials: 1,
  },
  {
    id: "creator",
    name: "Creator",
    tagline: "Escale sua produção e nunca mais fique sem conteúdo",
    monthlyCents: 9990,
    yearlyCents: 7990,
    credits: 3000,
    hours: 50,
    socials: 3,
    popular: true,
  },
  {
    id: "viral",
    name: "Viral",
    tagline: "Produção em escala para crescer rápido nas redes",
    monthlyCents: 14990,
    yearlyCents: 11990,
    credits: 5400,
    hours: 90,
    socials: 6,
  },
];

export const PLAN_FEATURES = [
  "Sem marca d'água",
  "Clipes em até 4K usando seu computador",
  "Editor profissional",
  "Importar vídeos",
  "Legendas automáticas",
  "Workspace com membros ilimitados",
  "Geração de voz com IA",
  "Postagem automática",
  "Giro de prêmios",
  "Check-in diário",
  "Monitoramento de lives",
  "Armazenamento por 60 dias",
  "Clipes de até 15 minutos",
  "Clipes na horizontal",
  "Hooks/B-rolls premium",
  "Auto Edit com IA",
  "Programa de afiliados",
  "Acesso à API",
];

/** 60 créditos = 1 hora de vídeo. Preço base: R$ 0,04 por crédito (300 créditos = R$ 12,00). */
export const CREDIT_PRICE_CENTS = 4;
export const PACKAGE_MIN = 250;
export const PACKAGE_MAX = 1200;
export const PACKAGE_PRESETS = [300, 600, 1200];

export function packagePriceCents(credits: number, method: "pix" | "card") {
  const base = credits * CREDIT_PRICE_CENTS;
  // Pix tem 5% de desconto sobre o cartão
  return method === "pix" ? base : Math.round(base * 1.05);
}

export function getPlan(id: string | null | undefined): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export const FREE_CLIPS = 3;
export const FREE_PROJECT_EXPIRY_DAYS = 3;
export const REFERRAL_SHARE = 0.5;
