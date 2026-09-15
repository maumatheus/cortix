import { z } from "zod";
import { db } from "@/lib/db";
import { newId, referralCode } from "@/lib/ids";
import { createSession, hashPassword, publicUser, verifyPassword } from "@/lib/auth";
import { errorResponse, fail, ok, readJson } from "@/lib/api";
import { checkLicenseOnline, licenseEnabled, offlineGraceOk } from "@/lib/license";

const schema = z.object({ email: z.string().min(1, "Informe o usuário ou e-mail"), password: z.string().min(1, "Informe a senha") });

/** Créditos que o app desktop mantém na conta licenciada (tudo roda local, sem cobrança). */
const DESKTOP_CREDITS = 100_000;

export async function POST(req: Request) {
  try {
    const body = schema.parse(await readJson(req));
    const email = body.email.toLowerCase().trim();

    if (!licenseEnabled()) {
      // modo site / desenvolvimento: conta local
      const user = await db.user.findUnique({ where: { email } });
      if (!user || !(await verifyPassword(body.password, user.passwordHash))) return fail("Usuário ou senha incorretos", 401);
      await createSession(user.id);
      return ok({ user: publicUser(user) });
    }

    // modo desktop: quem decide é o servidor de licenças
    const lic = await checkLicenseOnline(email, body.password);
    if (lic.ok) {
      const renews = lic.expiresAt ?? new Date(Date.now() + 365 * 86400_000);
      const existing = await db.user.findUnique({ where: { email: lic.email } });
      const passwordHash = await hashPassword(body.password);
      const user = existing
        ? await db.user.update({
            where: { id: existing.id },
            data: {
              name: lic.name || existing.name,
              passwordHash,
              plan: lic.plan,
              planCycle: "yearly",
              planRenewsAt: renews,
              credits: Math.max(existing.credits, DESKTOP_CREDITS),
              licenseCheckedAt: new Date(),
              licenseExpiresAt: lic.expiresAt,
            },
          })
        : await db.user.create({
            data: {
              id: newId(),
              name: lic.name || lic.email.split("@")[0],
              email: lic.email,
              passwordHash,
              credits: DESKTOP_CREDITS,
              referralCode: referralCode(),
              plan: lic.plan,
              planCycle: "yearly",
              planRenewsAt: renews,
              licenseCheckedAt: new Date(),
              licenseExpiresAt: lic.expiresAt,
            },
          });
      await createSession(user.id);
      return ok({ user: publicUser(user) });
    }

    if (lic.reason === "offline" || lic.reason === "erro") {
      // sem servidor: aceita por alguns dias quem já entrou com licença válida neste PC
      const user = await db.user.findUnique({ where: { email } });
      if (user && offlineGraceOk(user) && (await verifyPassword(body.password, user.passwordHash))) {
        await createSession(user.id);
        return ok({ user: publicUser(user), offline: true });
      }
      return fail(lic.message, 503);
    }

    return fail(lic.message, lic.reason === "senha" ? 401 : 403, { reason: lic.reason });
  } catch (e) {
    return errorResponse(e);
  }
}
