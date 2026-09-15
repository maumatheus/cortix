// Aplica um arquivo .sql de supabase/ no Supabase pessoal (projeto Fizpravoce, schema cortix).
// Uso: node scripts/supabase-db.mjs 001_cortix_licencas.sql
//
// Credenciais: ~/.claude/credentials/gerencia21.env (SUPABASE_DB_URL / SUPABASE_DB_PASSWORD / SUPABASE_PROJECT_REF).
// O host direto (db.<ref>.supabase.co) só responde em IPv6; sem rota IPv6 cai no pooler (aws-0-<regiao>.pooler.supabase.com).
import pg from "pg";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function lerEnv(arquivo) {
  const out = {};
  try {
    for (const linha of readFileSync(arquivo, "utf8").split(/\r?\n/)) {
      const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {}
  return out;
}

export function credenciais() {
  const env = { ...lerEnv(join(homedir(), ".claude", "credentials", "gerencia21.env")), ...process.env };
  const ref = env.SUPABASE_PROJECT_REF || (env.SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  if (!ref) throw new Error("SUPABASE_PROJECT_REF/SUPABASE_URL não encontrados");
  return { env, ref };
}

/** Tenta o host direto e depois os poolers por região; devolve um Client conectado. */
export async function conectar() {
  const { env, ref } = credenciais();
  const senha = env.SUPABASE_DB_PASSWORD;
  if (!senha) throw new Error("SUPABASE_DB_PASSWORD não encontrado");
  const tentativas = [
    { host: `db.${ref}.supabase.co`, port: 5432, user: "postgres" },
    // projetos novos ficam em aws-1-*, antigos em aws-0-*
    ...["us-east-2", "us-east-1", "sa-east-1", "us-west-1", "us-west-2", "eu-central-1"].flatMap((r) =>
      ["aws-1", "aws-0"].map((p) => ({ host: `${p}-${r}.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` })),
    ),
  ];
  const erros = [];
  for (const t of tentativas) {
    const c = new pg.Client({ ...t, password: senha, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
    try {
      await c.connect();
      console.log(`conectado em ${t.host}`);
      return c;
    } catch (e) {
      erros.push(`${t.host}: ${e.message.slice(0, 60)}`);
    }
  }
  throw new Error("não conectou:\n  " + erros.join("\n  "));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arquivo = process.argv[2];
  if (!arquivo) {
    console.error("uso: node scripts/supabase-db.mjs <arquivo.sql>");
    process.exit(1);
  }
  const sql = readFileSync(join(__dirname, "..", "supabase", arquivo), "utf8");
  const c = await conectar();
  try {
    await c.query(sql);
    console.log(`OK ${arquivo} (${sql.length} bytes)`);
  } catch (e) {
    console.error(`FALHOU ${arquivo}: ${e.message}`);
    process.exitCode = 2;
  } finally {
    await c.end();
  }
}
