/** Página mostrada no navegador do sistema ao voltar do login da rede (Google/Meta). */
export function oauthResultPage(rede: string, okay: boolean, msg: string) {
  const esc = msg.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cortix · ${rede}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b10;color:#eee;font-family:system-ui,sans-serif}
.c{max-width:420px;padding:32px;border:1px solid #2a2a35;border-radius:16px;background:#14141c;text-align:center}
h1{font-size:20px;margin:12px 0 8px}p{color:#aaa;font-size:14px;line-height:1.5}.i{font-size:40px}</style></head>
<body><div class="c"><div class="i">${okay ? "✅" : "⚠️"}</div><h1>${okay ? `${rede} conectado` : "Não deu pra conectar"}</h1><p>${esc}</p></div>
${okay ? "<script>setTimeout(()=>{try{window.close()}catch(e){}},4000)</script>" : ""}</body></html>`;
  return new Response(html, { status: okay ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
