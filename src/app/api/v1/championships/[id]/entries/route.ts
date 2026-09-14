import { z } from "zod";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { fail, ok, readJson, withUser } from "@/lib/api";
import { PLATFORM_VALUES, platformLabel, urlMatchesPlatform } from "@/lib/championships";
import { getChampionshipRequirements } from "@/lib/championships-server";

const schema = z.object({
  videoUrl: z.string().trim().url("Informe uma URL válida (com https://)"),
  platform: z.enum(PLATFORM_VALUES, { message: "Escolha TikTok, Instagram ou YouTube" }),
  category: z.string().trim().max(40).optional(),
});

/** Meus envios neste campeonato. */
export const GET = withUser(async ({ params, user }) => {
  const entries = await db.championshipEntry.findMany({ where: { championshipId: params.id, userId: user!.id }, orderBy: { createdAt: "desc" } });
  return ok({ data: entries });
});

/** Registra um vídeo no campeonato. Exige chave PIX e conta social vinculada. */
export const POST = withUser(async ({ req, params, user }) => {
  const body = schema.parse(await readJson(req));
  const champ = await db.championship.findUnique({ where: { id: params.id } });
  if (!champ) return fail("Campeonato não encontrado", 404);
  if (champ.status === "finished") return fail("Este campeonato já foi encerrado", 400);
  if (champ.status === "budget_exhausted") return fail("O orçamento deste campeonato já foi esgotado", 400);
  if (champ.endDate.getTime() < Date.now()) return fail("O prazo de envio deste campeonato já terminou", 400);

  const requirements = await getChampionshipRequirements(user!);
  if (!requirements.pixKey) return fail("Cadastre sua chave PIX antes de enviar vídeos — ela é necessária para receber prêmios", 400, { requirements });
  if (!requirements.socialAccount) return fail("Conecte pelo menos uma conta de rede social para enviar vídeos", 400, { requirements });

  if (!urlMatchesPlatform(body.videoUrl, body.platform)) {
    return fail(`A URL informada não parece ser do ${platformLabel(body.platform)}. Confira o link e a plataforma escolhida.`, 400);
  }

  const dup = await db.championshipEntry.findFirst({ where: { championshipId: champ.id, videoUrl: body.videoUrl } });
  if (dup) return fail(dup.userId === user!.id ? "Você já enviou este vídeo para este campeonato" : "Este vídeo já foi registrado por outro creator", 409);

  const entry = await db.championshipEntry.create({
    data: {
      id: newId(),
      championshipId: champ.id,
      userId: user!.id,
      videoUrl: body.videoUrl,
      platform: body.platform,
      category: champ.kind === "ranking" ? body.category || "clip" : null,
    },
  });
  return ok({ entry }, { status: 201 });
});
