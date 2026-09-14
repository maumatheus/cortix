import bcrypt from "bcryptjs";
import { db } from "./db";
import { newId } from "./ids";

export const STAFF_EMAIL = "equipe@cortix.app";

export interface TemplateConfig {
  styleId: string;
  layout: string;
  font: string;
  description?: string;
}

const PUBLIC_SEED: Array<TemplateConfig & { name: string; uses: number }> = [
  { name: "Podcast Viral", styleId: "green-fresh", layout: "split", font: "Montserrat", description: "Duas câmeras empilhadas com destaque verde. Ideal pra podcasts.", uses: 1284 },
  { name: "Reação Gamer", styleId: "reaction", layout: "react", font: "Luckiest Guy", description: "Gameplay no topo, câmera embaixo, legenda cartunesca.", uses: 962 },
  { name: "Karaokê Clean", styleId: "karaoke-orange", layout: "single", font: "Montserrat", description: "Legenda karaokê laranja na base, recorte central.", uses: 811 },
  { name: "Editorial Bold", styleId: "editorial-contrast", layout: "center", font: "Montserrat", description: "Vídeo inteiro com fundo desfocado e contraste editorial.", uses: 640 },
  { name: "Impacto Lime", styleId: "lime-impact", layout: "single", font: "Bungee", description: "Fonte pesada em verde-limão, três palavras por vez.", uses: 533 },
  { name: "Neon Stories", styleId: "neon-statement", layout: "split-vertical", font: "Montserrat", description: "Lado a lado com legenda neon. Perfeito pra Stories.", uses: 418 },
];

/** Garante o usuário da equipe (dono dos conteúdos públicos). */
export async function ensureStaffUser() {
  let staff = await db.user.findUnique({ where: { email: STAFF_EMAIL } });
  if (!staff) {
    staff = await db.user.create({
      data: { id: newId(), name: "Equipe Cortix", email: STAFF_EMAIL, passwordHash: await bcrypt.hash(newId(), 10), referralCode: "CORTIX", credits: 0 },
    });
  }
  return staff;
}

/** Cria os templates públicos de exemplo na primeira consulta à galeria. */
export async function ensurePublicTemplates() {
  const count = await db.template.count({ where: { isPublic: true } });
  if (count > 0) return;
  const staff = await ensureStaffUser();
  for (const t of PUBLIC_SEED) {
    await db.template.create({
      data: {
        id: newId(),
        userId: staff.id,
        name: t.name,
        config: JSON.stringify({ styleId: t.styleId, layout: t.layout, font: t.font, description: t.description }),
        isPublic: true,
        uses: t.uses,
      },
    });
  }
}

export function parseTemplateConfig(raw: string): TemplateConfig {
  try {
    const j = JSON.parse(raw) as Partial<TemplateConfig>;
    return { styleId: j.styleId || "green-fresh", layout: j.layout || "single", font: j.font || "Montserrat", description: j.description };
  } catch {
    return { styleId: "green-fresh", layout: "single", font: "Montserrat" };
  }
}

export function serializeTemplate(t: { id: string; userId: string; name: string; config: string; isPublic: boolean; uses: number; createdAt: Date; user?: { name: string } }, viewerId: string) {
  return { id: t.id, name: t.name, config: parseTemplateConfig(t.config), isPublic: t.isPublic, uses: t.uses, createdAt: t.createdAt, isMine: t.userId === viewerId, author: t.user?.name ?? null };
}
