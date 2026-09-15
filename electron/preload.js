// Ponte segura entre o processo principal e a tela de carregamento.
// Sem acesso a Node no lado da pagina: so estes dois metodos.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cortix", {
  /** Recebe os eventos de estado/progresso/atualizacao do processo principal. */
  aoReceber: (callback) => {
    ipcRenderer.on("cortix:evento", (_e, dados) => callback(dados));
  },
  /** Devolve a escolha do usuario: "atualizar" ou "depois". */
  responder: (escolha) => ipcRenderer.send("cortix:resposta", escolha),
});
