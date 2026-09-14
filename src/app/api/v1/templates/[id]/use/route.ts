import { db } from "@/lib/db";
import { fail, ok, withUser } from "@/lib/api";
import { getCaptionStyle } from "@/lib/caption-styles";

/** Registra um uso do template e devolve a configuração pronta pra aplicar num projeto. */
export const POST = withUser(async ({ params, user }) => {
  const t = await db.template.findFirst({ where: { id: params.id, OR: [{ userId: user!.id }, { isPublic: true }] } });
  if (!t) return fail("Template não encontrado", 404);
  const updated = await db.template.update({ where: { id: t.id }, data: { uses: { increment: 1 } } });
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(t.config);
  } catch {}
  const styleId = typeof config.styleId === "string" ? config.styleId : "green-fresh";
  const font = typeof config.font === "string" ? config.font : "Montserrat";
  const captionTemplate = { ...getCaptionStyle(styleId), fontFamily: font };
  return ok({
    config,
    uses: updated.uses,
    apply: { captionStyleId: styleId, captionFont: font, layout: typeof config.layout === "string" ? config.layout : "single", captionTemplate },
  });
});
