// Sobe o servidor empacotado (pacote/app/.next/standalone) sem a janela do Electron, com o
// mesmo ambiente que electron/main.js monta. Útil pra QA headless e pra rodar num servidor.
//   node scripts/run-standalone.mjs [porta] [pastaDados]
// Padrão: porta 43111, dados em ./storage/standalone-data (banco cortix.db copiado do semente).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";

const raiz = process.cwd();
const porta = Number(process.argv[2] || 43111);
const dados = path.resolve(process.argv[3] || path.join(raiz, "storage", "standalone-data"));
const app = path.join(raiz, "pacote", "app");
const servidorJs = path.join(app, ".next", "standalone", "server.js");
if (!fs.existsSync(servidorJs)) {
  console.error("rode `npm run dist:prep` antes (falta pacote/app/.next/standalone/server.js)");
  process.exit(1);
}
fs.mkdirSync(dados, { recursive: true });

const banco = path.join(dados, "cortix.db");
if (!fs.existsSync(banco)) fs.copyFileSync(path.join(app, "cortix-semente.db"), banco);
const fontes = path.join(dados, "storage", "fonts");
if (!fs.existsSync(fontes)) fs.cpSync(path.join(app, "fontes"), fontes, { recursive: true });

const lerOuCriar = (nome, gerar) => {
  const f = path.join(dados, nome);
  try {
    const v = fs.readFileSync(f, "utf8").trim();
    if (v) return v;
  } catch {}
  const v = gerar();
  fs.writeFileSync(f, v, "utf8");
  return v;
};
let licenca = {};
try {
  const j = JSON.parse(fs.readFileSync(path.join(app, "licenca.json"), "utf8"));
  if (j.url && j.anonKey) licenca = { CORTIX_LICENSE_URL: j.url, CORTIX_LICENSE_ANON_KEY: j.anonKey };
} catch {}
const bin = path.join(raiz, "pacote", "bin");
const seExistir = (nome) => (fs.existsSync(path.join(bin, nome)) ? path.join(bin, nome) : "");

const env = {
  ...process.env,
  NODE_ENV: "production",
  PORT: String(porta),
  HOSTNAME: "127.0.0.1",
  DATABASE_URL: "file:" + banco.replace(/\\/g, "/"),
  STORAGE_DIR: path.join(dados, "storage"),
  APP_URL: `http://127.0.0.1:${porta}`,
  FFMPEG_PATH: seExistir("ffmpeg.exe"),
  FFPROBE_PATH: seExistir("ffprobe.exe"),
  YTDLP_PATH: seExistir("yt-dlp.exe"),
  JWT_SECRET: lerOuCriar("jwt.secret", () => randomBytes(48).toString("base64url")),
  ALLOW_MOCK_PAYMENTS: "true",
  CORTIX_DESKTOP: "1",
  CORTIX_DEVICE_ID: lerOuCriar("device.id", () => randomUUID()),
  CORTIX_HOSTNAME: os.hostname(),
  CORTIX_APP_VERSION: JSON.parse(fs.readFileSync(path.join(raiz, "package.json"), "utf8")).version + "-standalone",
  ...licenca,
};
console.log(`servidor empacotado em http://127.0.0.1:${porta} · dados em ${dados} · licença ${licenca.CORTIX_LICENSE_URL ? "ON" : "OFF (login local)"}`);
const p = spawn(process.execPath, [servidorJs], { cwd: path.dirname(servidorJs), env, stdio: "inherit" });
p.on("exit", (c) => process.exit(c ?? 0));
