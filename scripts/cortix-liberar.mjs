// Libera / bloqueia / lista quem pode entrar no Cortix desktop.
// Cria o usuário no Supabase Auth (se não existir) e a linha em cortix.licenses.
//
//   node scripts/cortix-liberar.mjs liberar  <email> <senha> [--nome "Fulano"] [--plano viral] [--dias 30] [--dispositivos 2]
//   node scripts/cortix-liberar.mjs bloquear <email>
//   node scripts/cortix-liberar.mjs senha    <email> <nova-senha>
//   node scripts/cortix-liberar.mjs listar
//
// Usa a service_role de ~/.claude/credentials/gerencia21.env — nunca coloque essa chave no app.
import { credenciais } from "./supabase-db.mjs";

const { env } = credenciais();
const URL = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function api(path, init = {}, schema) {
  const r = await fetch(`${URL}${path}`, { ...init, headers: { ...H, ...(schema ? { "Accept-Profile": schema, "Content-Profile": schema } : {}), ...(init.headers || {}) } });
  const txt = await r.text();
  let json = null;
  try {
    json = txt ? JSON.parse(txt) : null;
  } catch {}
  if (!r.ok) throw new Error(`${r.status} ${path}: ${json?.msg || json?.message || json?.error_description || txt.slice(0, 200)}`);
  return json;
}

async function acharUsuario(email) {
  // GoTrue admin não filtra por e-mail em todas as versões: pagina e procura.
  for (let page = 1; page <= 50; page++) {
    const j = await api(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const u = (j.users || []).find((x) => (x.email || "").toLowerCase() === email);
    if (u) return u;
    if (!j.users || j.users.length < 200) break;
  }
  return null;
}

function arg(nome, padrao) {
  const i = process.argv.indexOf(nome);
  return i > -1 ? process.argv[i + 1] : padrao;
}

const [cmd, emailArg, senhaArg] = process.argv.slice(2);
const email = (emailArg || "").toLowerCase().trim();

if (cmd === "listar") {
  const rows = await api(`/rest/v1/licenses?select=email,name,plan,active,expires_at,max_devices,created_at&order=created_at`, {}, "cortix");
  const devs = await api(`/rest/v1/devices?select=user_id,hostname,last_seen_at`, {}, "cortix");
  for (const r of rows) console.log(`${r.active ? "✔" : "✖"} ${r.email.padEnd(36)} ${r.plan.padEnd(8)} ${r.expires_at ? "até " + r.expires_at.slice(0, 10) : "sem validade"}  máx ${r.max_devices} disp.`);
  console.log(`${rows.length} licença(s), ${devs.length} dispositivo(s) registrado(s)`);
} else if (cmd === "liberar") {
  if (!email || !senhaArg) {
    console.error("uso: liberar <email> <senha> [--nome ..] [--plano viral] [--dias 30] [--dispositivos 2]");
    process.exit(1);
  }
  let u = await acharUsuario(email);
  if (!u) {
    u = await api(`/auth/v1/admin/users`, { method: "POST", body: JSON.stringify({ email, password: senhaArg, email_confirm: true, user_metadata: { name: arg("--nome", email.split("@")[0]), app: "cortix" } }) });
    console.log(`usuário criado no Supabase Auth: ${u.id}`);
  } else {
    await api(`/auth/v1/admin/users/${u.id}`, { method: "PUT", body: JSON.stringify({ password: senhaArg, email_confirm: true }) });
    console.log(`usuário já existia (${u.id}); senha atualizada`);
  }
  const dias = Number(arg("--dias", "0"));
  const lic = {
    user_id: u.id,
    email,
    name: arg("--nome", u.user_metadata?.name || email.split("@")[0]),
    plan: arg("--plano", "viral"),
    active: true,
    expires_at: dias > 0 ? new Date(Date.now() + dias * 86400_000).toISOString() : null,
    max_devices: Number(arg("--dispositivos", "2")),
    updated_at: new Date().toISOString(),
  };
  await api(`/rest/v1/licenses?on_conflict=user_id`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(lic) }, "cortix");
  console.log(`✔ liberado: ${email} · plano ${lic.plan} · ${lic.expires_at ? "até " + lic.expires_at.slice(0, 10) : "sem validade"} · ${lic.max_devices} dispositivo(s)`);
} else if (cmd === "bloquear") {
  await api(`/rest/v1/licenses?email=eq.${encodeURIComponent(email)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ active: false, updated_at: new Date().toISOString() }) }, "cortix");
  console.log(`✖ bloqueado: ${email} (não entra mais no app a partir do próximo login)`);
} else if (cmd === "senha") {
  const u = await acharUsuario(email);
  if (!u) throw new Error("usuário não encontrado");
  await api(`/auth/v1/admin/users/${u.id}`, { method: "PUT", body: JSON.stringify({ password: senhaArg }) });
  console.log(`senha de ${email} atualizada`);
} else {
  console.error("comandos: liberar | bloquear | senha | listar");
  process.exit(1);
}
