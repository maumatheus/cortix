import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./db";

const COOKIE = "cf_session";
const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret());
      if (payload.sub) return payload.sub as string;
    } catch {}
  }
  return autoLoginUserId();
}

/**
 * Instância local sem tela de login (ex.: Cortix do estúdio em 127.0.0.1): CORTIX_AUTO_LOGIN=<usuário ou e-mail>
 * entra direto nessa conta quando não há sessão. Quem fizer login continua podendo trocar de conta.
 */
let autoLoginCache: string | null | undefined;
async function autoLoginUserId(): Promise<string | null> {
  const alvo = process.env.CORTIX_AUTO_LOGIN?.trim().toLowerCase();
  if (!alvo) return null;
  if (autoLoginCache === undefined) {
    autoLoginCache = (await db.user.findUnique({ where: { email: alvo }, select: { id: true } }))?.id ?? null;
  }
  return autoLoginCache;
}

export async function getCurrentUser() {
  const id = await getSessionUserId();
  if (!id) return null;
  return db.user.findUnique({ where: { id } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError();
  return user;
}

export class AuthError extends Error {
  status = 401;
  constructor() {
    super("Não autenticado");
  }
}

export function isSubscriber(user: { plan: string | null; planRenewsAt: Date | null }) {
  if (!user.plan) return false;
  if (user.planRenewsAt && user.planRenewsAt.getTime() < Date.now()) return false;
  return true;
}

export function publicUser(u: {
  id: string;
  name: string;
  email: string;
  credits: number;
  freeClipsUsed: number;
  plan: string | null;
  planCycle: string | null;
  planRenewsAt: Date | null;
  referralCode: string;
  pixKey: string | null;
  locale: string;
  theme: string;
  streak: number;
  lastCheckinAt: Date | null;
  surveyDoneAt: Date | null;
  channel?: string | null;
  createdAt: Date;
}) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    credits: u.credits,
    freeClipsUsed: u.freeClipsUsed,
    freeClipsLeft: Math.max(0, 3 - u.freeClipsUsed),
    plan: u.plan,
    planCycle: u.planCycle,
    planRenewsAt: u.planRenewsAt,
    isSubscriber: isSubscriber(u),
    referralCode: u.referralCode,
    pixKey: u.pixKey,
    locale: u.locale,
    theme: u.theme,
    streak: u.streak,
    lastCheckinAt: u.lastCheckinAt,
    surveyDone: !!u.surveyDoneAt,
    channel: u.channel ?? null,
    createdAt: u.createdAt,
  };
}

export type PublicUser = ReturnType<typeof publicUser>;
