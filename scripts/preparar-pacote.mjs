// Monta a pasta "pacote/" que vai dentro do instalador.
// Roda depois de `next build` e antes do electron-builder (script "dist:prep").
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const raiz = process.cwd();
const destino = path.join(raiz, "pacote");
const destinoApp = path.join(destino, "app");
const destinoBin = path.join(destino, "bin");

function limpar(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copiar(de, para, rotulo) {
  if (!fs.existsSync(de)) {
    console.log(`  (pulado) ${rotulo}: nao encontrado em ${de}`);
    return false;
  }
  fs.cpSync(de, para, { recursive: true });
  console.log(`  ok ${rotulo}`);
  return true;
}

// 1) build standalone do Next + estaticos (o standalone nao copia esses dois sozinho)
const standalone = path.join(raiz, ".next", "standalone");
if (!fs.existsSync(standalone)) {
  console.error('ERRO: rode "npm run build" antes (falta .next/standalone).');
  process.exit(1);
}

console.log("Montando pacote/...");
limpar(destino);
fs.mkdirSync(destinoApp, { recursive: true });
fs.mkdirSync(destinoBin, { recursive: true });
copiar(standalone, path.join(destinoApp, ".next", "standalone"), "servidor Next");
copiar(path.join(raiz, ".next", "static"), path.join(destinoApp, ".next", "standalone", ".next", "static"), "estaticos");
copiar(path.join(raiz, "public"), path.join(destinoApp, ".next", "standalone", "public"), "public (servidor)");
copiar(path.join(raiz, "public"), path.join(destinoApp, "public"), "public (marca)");
copiar(path.join(raiz, "prisma", "schema.prisma"), path.join(destinoApp, "prisma", "schema.prisma"), "schema do banco");
copiar(path.join(raiz, "build", "icon.ico"), path.join(destinoApp, "build", "icon.ico"), "icone");

// o cache do webpack e o typescript nao servem em runtime e pesam centenas de MB;
// .env, banco de desenvolvimento e storage NUNCA podem ir dentro do instalador
for (const lixo of [
  path.join(destinoApp, ".next", "standalone", ".next", "cache"),
  path.join(destinoApp, ".next", "standalone", "node_modules", "typescript"),
  path.join(destinoApp, ".next", "standalone", "node_modules", "@types"),
  path.join(destinoApp, ".next", "standalone", ".env"),
  path.join(destinoApp, ".next", "standalone", ".env.local"),
  path.join(destinoApp, ".next", "standalone", "prisma", "dev.db"),
  path.join(destinoApp, ".next", "standalone", "prisma", "dev.db-journal"),
  path.join(destinoApp, ".next", "standalone", "storage"),
  // o tracing do Next arrasta a saida de builds anteriores (1,2 GB) se elas existirem na raiz
  path.join(destinoApp, ".next", "standalone", "dist"),
  path.join(destinoApp, ".next", "standalone", "pacote"),
  path.join(destinoApp, ".next", "standalone", ".git"),
]) {
  if (fs.existsSync(lixo)) {
    fs.rmSync(lixo, { recursive: true, force: true });
    console.log(`  removido do pacote: ${path.basename(lixo)}`);
  }
}

// 2) binarios de video: o usuario final nao deve precisar instalar nada
const instalado = "C:/Program Files/Cortix/resources/bin"; // reaproveita os binarios de um Cortix ja instalado
const candidatos = {
  "ffmpeg.exe": [process.env.FFMPEG_PATH, "C:/Users/rafas/tools/ffmpeg-9.0.1-essentials_build/bin/ffmpeg.exe", `${instalado}/ffmpeg.exe`],
  "ffprobe.exe": [process.env.FFPROBE_PATH, "C:/Users/rafas/tools/ffmpeg-9.0.1-essentials_build/bin/ffprobe.exe", `${instalado}/ffprobe.exe`],
  "yt-dlp.exe": [process.env.YTDLP_PATH, "C:/Users/rafas/tools/Python312/Scripts/yt-dlp.exe", `${instalado}/yt-dlp.exe`],
};
// Tamanho minimo de um binario de verdade. O "yt-dlp.exe" da pasta Scripts do Python e um
// launcher de 100 KB que so funciona com aquele Python instalado — nunca pode ir no pacote.
const MINIMO_MB = { "ffmpeg.exe": 20, "ffprobe.exe": 20, "yt-dlp.exe": 5 };
const YTDLP_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
const valido = (p, nome) => {
  try {
    return fs.existsSync(p) && fs.statSync(p).size / 1024 / 1024 >= (MINIMO_MB[nome] || 0);
  } catch {
    return false;
  }
};
const faltando = [];
for (const [nome, opcoes] of Object.entries(candidatos)) {
  let achado = opcoes.filter(Boolean).find((p) => valido(p, nome));
  if (!achado && nome === "yt-dlp.exe") {
    // baixa o binario standalone oficial (~18 MB) direto do GitHub
    const alvo = path.join(destinoBin, nome);
    console.log(`  baixando ${nome} de ${YTDLP_URL}...`);
    const r = spawnSync("curl", ["-sL", "-o", alvo, YTDLP_URL], { stdio: "inherit" });
    if (r.status === 0 && valido(alvo, nome)) achado = alvo;
    else if (fs.existsSync(alvo)) fs.rmSync(alvo);
  }
  if (achado) {
    if (achado !== path.join(destinoBin, nome)) fs.copyFileSync(achado, path.join(destinoBin, nome));
    const mb = (fs.statSync(achado).size / 1024 / 1024).toFixed(0);
    console.log(`  ok ${nome} (${mb} MB)`);
  } else {
    faltando.push(nome);
  }
}
if (faltando.length) {
  console.log(`  ATENCAO: ${faltando.join(", ")} nao encontrados — o app vai depender do PATH do usuario.`);
}

// 3) fontes das legendas ja baixadas entram junto, para nao baixar no primeiro uso
copiar(path.join(raiz, "storage", "fonts"), path.join(destinoApp, "fontes"), "fontes das legendas");

// 4) banco semente: schema atual + seed (missoes, conta equipe). Vira o cortix.db no primeiro uso.
const semente = path.join(destinoApp, "cortix-semente.db");
const envSemente = { ...process.env, DATABASE_URL: "file:" + semente.replace(/\\/g, "/") };
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
for (const args of [
  ["prisma", "db", "push", "--skip-generate"],
  ["tsx", "prisma/seed.ts"],
  ["tsx", "scripts/criar-admin.ts", "admin", "12345"], // conta local do app desktop
]) {
  const r = spawnSync(npx, args, { cwd: raiz, env: envSemente, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`ERRO ao gerar o banco semente (${args.join(" ")})`);
    process.exit(1);
  }
}
for (const sobra of [semente + "-journal"]) if (fs.existsSync(sobra)) fs.rmSync(sobra);
console.log("  ok banco semente");

function tamanhoMb(dir) {
  let total = 0;
  const andar = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) andar(p);
      else total += fs.statSync(p).size;
    }
  };
  andar(dir);
  return (total / 1024 / 1024).toFixed(0);
}
console.log(`Pacote pronto: ${tamanhoMb(destino)} MB em ${destino}`);
