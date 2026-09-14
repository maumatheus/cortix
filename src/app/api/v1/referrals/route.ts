import { db } from "@/lib/db";
import { ok, withUser } from "@/lib/api";
import { maskName } from "@/lib/referrals";
import { REFERRAL_SHARE } from "@/lib/plans";

export const GET = withUser(async ({ user }) => {
  const referrals = await db.referral.findMany({
    where: { referrerId: user!.id },
    orderBy: { createdAt: "desc" },
    include: { referred: { select: { name: true, createdAt: true } } },
  });
  const purchased = referrals.filter((r) => r.status === "purchased");
  const stats = {
    invited: referrals.length,
    pending: referrals.length - purchased.length,
    purchased: purchased.length,
    creditsEarned: purchased.reduce((s, r) => s + r.creditsAwarded, 0),
  };
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return ok({
    code: user!.referralCode,
    link: `${appUrl}/register?ref=${user!.referralCode}`,
    sharePct: Math.round(REFERRAL_SHARE * 100),
    stats,
    referrals: referrals.map((r) => ({
      id: r.id,
      name: maskName(r.referred.name),
      status: r.status,
      creditsAwarded: r.creditsAwarded,
      createdAt: r.createdAt,
    })),
  });
});
