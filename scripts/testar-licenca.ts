// Testa o login online (Supabase Auth + cortix.check_license) sem abrir o app.
// Uso: npx tsx scripts/testar-licenca.ts <email> <senha>
// Lê URL/anon key de CORTIX_LICENSE_* ou de ~/.claude/credentials/gerencia21.env (nada é impresso).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function lerEnv(arquivo: string) {
  const out: Record<string, string> = {};
  try {
    for (const l of fs.readFileSync(arquivo, "utf8").split(/\r?\n/)) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {}
  return out;
}
const cred = lerEnv(path.join(os.homedir(), ".claude", "credentials", "gerencia21.env"));
process.env.CORTIX_LICENSE_URL ||= cred.SUPABASE_URL;
process.env.CORTIX_LICENSE_ANON_KEY ||= cred.SUPABASE_ANON_KEY_LEGACY || cred.SUPABASE_ANON_KEY;
process.env.CORTIX_DEVICE_ID ||= "teste-" + os.hostname();
process.env.CORTIX_HOSTNAME ||= os.hostname();
process.env.CORTIX_APP_VERSION ||= "teste";

async function main() {
const { checkLicenseOnline, licenseEnabled } = await import("../src/lib/license");
if (!licenseEnabled()) {
  console.error("sem CORTIX_LICENSE_URL/ANON_KEY");
  process.exit(1);
}
const [email, senha] = process.argv.slice(2);
if (!email || !senha) {
  console.error("uso: npx tsx scripts/testar-licenca.ts <email> <senha>");
  process.exit(1);
}
for (const [rotulo, e, s] of [
  ["senha certa", email, senha],
  ["senha errada", email, senha + "x"],
  ["sem licença", "ninguem-" + Date.now() + "@exemplo.com", "qualquer1"],
] as const) {
  const r = await checkLicenseOnline(e, s);
  console.log(`${rotulo.padEnd(13)} →`, r.ok ? `OK plano=${r.plan} validade=${r.expiresAt ? r.expiresAt.toISOString().slice(0, 10) : "sem"}` : `${r.reason}: ${r.message}`);
}
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
