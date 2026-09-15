// Processo principal do Cortix Desktop.
// 1) abre a tela de carregamento com a marca
// 2) procura atualizacao e, se houver, pergunta e baixa mostrando a porcentagem
// 3) sobe o servidor Next embutido e abre a janela do app
const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const http = require("node:http");

const DEV = !app.isPackaged;
const PORTA = Number(process.env.CORTIX_PORT || 43110);
const URL_BASE = `http://127.0.0.1:${PORTA}`;

let janelaSplash = null;
let janelaApp = null;
let servidor = null;
let respostaDoUsuario = null;

/** Raiz dos arquivos do app: dentro de resources quando empacotado. */
function raizRecursos() {
  return DEV ? path.join(__dirname, "..") : path.join(process.resourcesPath, "app");
}

/** Pasta gravavel para banco, videos e renders (Program Files e somente leitura). */
function pastaDados() {
  const p = app.getPath("userData");
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function avisar(dados) {
  if (janelaSplash && !janelaSplash.isDestroyed()) janelaSplash.webContents.send("cortix:evento", dados);
}

function abrirSplash() {
  janelaSplash = new BrowserWindow({
    width: 460,
    height: 420,
    frame: false,
    resizable: false,
    show: false,
    backgroundColor: "#07090c",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  janelaSplash.loadFile(path.join(__dirname, "splash.html"));
  janelaSplash.once("ready-to-show", () => {
    janelaSplash.show();
    avisar({ tipo: "versao", versao: app.getVersion() });
    // a logo vai como data URI para nao depender de caminho dentro do pacote
    try {
      const png = path.join(raizRecursos(), "public", "marca", "cortix-simbolo.png");
      if (fs.existsSync(png)) {
        avisar({ tipo: "marca", dataUri: "data:image/png;base64," + fs.readFileSync(png).toString("base64") });
      }
    } catch {}
  });
}

/** Espera o servidor Next responder. */
function esperarServidor(tentativas = 120) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const repetir = () => {
      if (++n >= tentativas) return reject(new Error("o servidor interno nao respondeu a tempo"));
      setTimeout(tentar, 500);
    };
    const tentar = () => {
      const req = http.get(`${URL_BASE}/login`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve();
        else repetir();
      });
      req.on("error", repetir);
      req.setTimeout(2500, () => {
        req.destroy();
        repetir();
      });
    };
    tentar();
  });
}

/** Segredo dos tokens de login: gerado uma vez por instalacao (nao vai mais dentro do pacote). */
function segredoJwt() {
  const arquivo = path.join(pastaDados(), "jwt.secret");
  try {
    const atual = fs.readFileSync(arquivo, "utf8").trim();
    if (atual.length >= 32) return atual;
  } catch {}
  const novo = require("node:crypto").randomBytes(48).toString("base64url");
  fs.writeFileSync(arquivo, novo, "utf8");
  return novo;
}

function subirServidor() {
  const raiz = raizRecursos();
  const servidorJs = path.join(raiz, ".next", "standalone", "server.js");
  if (!fs.existsSync(servidorJs)) throw new Error("build do Next nao encontrado em " + servidorJs);

  const dados = pastaDados();
  const bin = path.join(process.resourcesPath, "bin");
  const seExistir = (nome, alternativa) => {
    const p = path.join(bin, nome);
    return fs.existsSync(p) ? p : alternativa || "";
  };

  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(PORTA),
    HOSTNAME: "127.0.0.1",
    DATABASE_URL: "file:" + path.join(dados, "cortix.db").replace(/\\/g, "/"),
    STORAGE_DIR: path.join(dados, "storage"),
    APP_URL: URL_BASE,
    JWT_SECRET: segredoJwt(),
    ALLOW_MOCK_PAYMENTS: "true",
    // binarios que vao junto no instalador; se nao existirem, cai no PATH do usuario
    FFMPEG_PATH: seExistir("ffmpeg.exe", process.env.FFMPEG_PATH),
    FFPROBE_PATH: seExistir("ffprobe.exe", process.env.FFPROBE_PATH),
    YTDLP_PATH: seExistir("yt-dlp.exe", process.env.YTDLP_PATH),
    ELECTRON_RUN_AS_NODE: "1",
  };

  servidor = spawn(process.execPath, [servidorJs], {
    cwd: path.join(raiz, ".next", "standalone"),
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const log = fs.createWriteStream(path.join(dados, "servidor.log"), { flags: "a" });
  servidor.stdout.pipe(log);
  servidor.stderr.pipe(log);
}

function abrirApp() {
  janelaApp = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: "#07090c",
    autoHideMenuBar: true,
    icon: path.join(raizRecursos(), "build", "icon.ico"),
    title: "Cortix",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  janelaApp.loadURL(URL_BASE);
  janelaApp.once("ready-to-show", () => {
    janelaApp.show();
    if (janelaSplash && !janelaSplash.isDestroyed()) janelaSplash.close();
    janelaSplash = null;
  });
  // links externos abrem no navegador do sistema
  janelaApp.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(URL_BASE)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
}

/** Procura atualizacao. Resolve quando puder seguir para o app. */
function verificarAtualizacao() {
  return new Promise((resolve) => {
    if (DEV) return resolve();

    autoUpdater.autoDownload = false;
    autoUpdater.on("error", () => resolve()); // falha ao checar nao pode travar o app
    autoUpdater.on("update-not-available", () => resolve());

    autoUpdater.on("update-available", (info) => {
      avisar({ tipo: "perguntar-atualizacao", versao: info.version });
      respostaDoUsuario = (escolha) => {
        if (escolha !== "atualizar") return resolve();
        avisar({ tipo: "progresso", texto: "Baixando a atualização…", pct: 0, detalhe: "" });
        autoUpdater.downloadUpdate().catch(() => {
          avisar({ tipo: "erro", texto: "Não foi possível baixar. Abrindo a versão atual…" });
          setTimeout(resolve, 1600);
        });
      };
    });

    autoUpdater.on("download-progress", (p) => {
      const mb = (n) => (n / 1024 / 1024).toFixed(1) + " MB";
      avisar({
        tipo: "progresso",
        texto: "Baixando a atualização…",
        pct: p.percent,
        detalhe: `${mb(p.transferred)} de ${mb(p.total)}`,
      });
    });

    autoUpdater.on("update-downloaded", () => {
      avisar({ tipo: "estado", texto: "Instalando e reiniciando…" });
      setTimeout(() => autoUpdater.quitAndInstall(true, true), 900);
    });

    avisar({ tipo: "estado", texto: "Procurando atualizações…" });
    autoUpdater.checkForUpdates().catch(() => resolve());
  });
}

ipcMain.on("cortix:resposta", (_e, escolha) => {
  if (respostaDoUsuario) {
    const f = respostaDoUsuario;
    respostaDoUsuario = null;
    f(escolha);
  }
});

// uma instancia so: clicar no atalho de novo traz a janela existente
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const j = janelaApp || janelaSplash;
    if (j) {
      if (j.isMinimized()) j.restore();
      j.focus();
    }
  });

  app.whenReady().then(async () => {
    abrirSplash();
    await verificarAtualizacao();
    try {
      avisar({ tipo: "estado", texto: "Preparando o Cortix…" });
      subirServidor();
      await esperarServidor();
      abrirApp();
    } catch (e) {
      avisar({ tipo: "erro", texto: "Não foi possível iniciar." });
      dialog.showErrorBox("Cortix", "Não foi possível iniciar o Cortix.\n\n" + (e && e.message ? e.message : e));
      app.quit();
    }
  });
}

function encerrarServidor() {
  if (servidor && !servidor.killed) {
    try {
      servidor.kill();
    } catch {}
    servidor = null;
  }
}
app.on("window-all-closed", () => {
  encerrarServidor();
  app.quit();
});
app.on("before-quit", encerrarServidor);
