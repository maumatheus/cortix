/**
 * Login online do app desktop: senha conferida no Supabase Auth e licença em cortix.licenses
 * (RPC cortix.check_license). Todo o resto do app roda local.
 *
 * Ativado quando CORTIX_LICENSE_URL e CORTIX_LICENSE_ANON_KEY estão no ambiente (o Electron
 * carrega de resources/app/licenca.json). Sem eles, o login é o local de sempre (site / dev).
 */
export interface LicenseOk {
  ok: true;
  email: string;
  name: string | null;
  plan: string;
  expiresAt: Date | null;
  maxDevices: number;
}
export interface LicenseFail {
  ok: false;
  reason: "senha" | "sem_licenca" | "bloqueado" | "expirado" | "limite_dispositivos" | "nao_autenticado" | "offline" | "erro";
  message: string;
}
export type LicenseResult = LicenseOk | LicenseFail;

export function licenseEnabled() {
  return !!(process.env.CORTIX_LICENSE_URL && process.env.CORTIX_LICENSE_ANON_KEY);
}

/** Dias que um login válido continua valendo sem internet. */
export const OFFLINE_GRACE_DAYS = 3;

const MSG: Record<LicenseFail["reason"], string> = {
  senha: "Usuário ou senha incorretos",
  sem_licenca: "Esta conta não tem licença do Cortix. Fale com o administrador.",
  bloqueado: "Esta conta foi bloqueada. Fale com o administrador.",
  expirado: "Sua licença expirou. Fale com o administrador para renovar.",
  limite_dispositivos: "Limite de dispositivos atingido para esta conta.",
  nao_autenticado: "Não foi possível validar a sessão. Tente de novo.",
  offline: "Sem conexão com o servidor de licenças.",
  erro: "Servidor de licenças indisponível no momento.",
};

function fail(reason: LicenseFail["reason"], extra?: string): LicenseFail {
  return { ok: false, reason, message: extra ? `${MSG[reason]} (${extra})` : MSG[reason] };
}

export async function checkLicenseOnline(email: string, password: string): Promise<LicenseResult> {
  const url = process.env.CORTIX_LICENSE_URL!.replace(/\/$/, "");
  const anon = process.env.CORTIX_LICENSE_ANON_KEY!;
  const device = process.env.CORTIX_DEVICE_ID || "desconhecido";
  const hostname = process.env.CORTIX_HOSTNAME || null;
  const version = process.env.CORTIX_APP_VERSION || null;
  const timeout = (ms: number) => AbortSignal.timeout(ms);

  // 1) senha no Supabase Auth
  let token: string;
  try {
    const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anon, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: timeout(12_000),
    });
    if (r.status === 400 || r.status === 401 || r.status === 403) return fail("senha");
    if (!r.ok) return fail("erro", `HTTP ${r.status}`);
    const j = (await r.json()) as { access_token?: string };
    if (!j.access_token) return fail("erro");
    token = j.access_token;
  } catch (e) {
    return fail("offline", (e as Error).name === "TimeoutError" ? "tempo esgotado" : undefined);
  }

  // 2) licença + registro do dispositivo
  try {
    const r = await fetch(`${url}/rest/v1/rpc/check_license`, {
      method: "POST",
      headers: { apikey: anon, Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Content-Profile": "cortix" },
      body: JSON.stringify({ p_device_id: device, p_hostname: hostname, p_version: version }),
      signal: timeout(12_000),
    });
    if (!r.ok) return fail("erro", `HTTP ${r.status}`);
    const j = (await r.json()) as { ok: boolean; reason?: string; email?: string; name?: string | null; plan?: string; expires_at?: string | null; max_devices?: number };
    if (!j.ok) {
      const reason = (j.reason || "erro") as LicenseFail["reason"];
      return fail(reason in MSG ? reason : "erro");
    }
    return {
      ok: true,
      email: (j.email || email).toLowerCase(),
      name: j.name ?? null,
      plan: j.plan || "viral",
      expiresAt: j.expires_at ? new Date(j.expires_at) : null,
      maxDevices: j.max_devices ?? 2,
    };
  } catch (e) {
    return fail("offline", (e as Error).name === "TimeoutError" ? "tempo esgotado" : undefined);
  }
}

/** Login válido sem internet: último check recente e licença não expirada. */
export function offlineGraceOk(u: { licenseCheckedAt: Date | null; licenseExpiresAt: Date | null }) {
  if (!u.licenseCheckedAt) return false;
  if (Date.now() - u.licenseCheckedAt.getTime() > OFFLINE_GRACE_DAYS * 86400_000) return false;
  if (u.licenseExpiresAt && u.licenseExpiresAt.getTime() < Date.now()) return false;
  return true;
}
