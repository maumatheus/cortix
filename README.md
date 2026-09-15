# Cortix

Plataforma de cortes automáticos para YouTube, Twitch, Kick e uploads: cola o link, a IA escolhe os melhores momentos, gera cortes 9:16 com legendas dinâmicas (destaque palavra a palavra) e renderiza MP4 pronto para TikTok, Reels e Shorts. Inclui créditos, planos, missões, convites, comunidade, campeonatos, brand kit, templates, biblioteca, agendamento, launchers, monitoramento de lives, editor de cortes e servidor MCP para conectar IAs.

## Requisitos

- Node.js 22+
- FFmpeg (ffmpeg + ffprobe) e yt-dlp no PATH (ou configure `FFMPEG_PATH`, `FFPROBE_PATH`, `YTDLP_PATH` no `.env`). No Windows: `winget install Gyan.FFmpeg yt-dlp.yt-dlp`.
- (Opcional) `ANTHROPIC_API_KEY` para a seleção de momentos e títulos por IA. Sem a chave o sistema usa uma heurística local.

## Rodando

```bash
npm install
npm run setup     # prisma generate + db push + seed + baixa as fontes das legendas
npm run dev       # http://localhost:3000
```

Crie uma conta em `/register`. Cada conta nova ganha 3 cortes grátis (com marca d'água). Para testar planos e pacotes, o checkout é simulado: gere o PIX e clique em "Confirmar pagamento (simulação)".

## Como o pipeline funciona

1. `POST /api/v1/videoMetadata` valida o link (yt-dlp `-J`).
2. `POST /api/v1/projects` cobra créditos (1 crédito por minuto analisado) ou usa os cortes grátis e enfileira o projeto.
3. O worker (`src/lib/video/pipeline.ts`, fila em memória em `queue.ts`) baixa o vídeo em 720p, baixa as legendas automáticas (json3 → palavras com tempo), escolhe os momentos (`highlights.ts`, IA ou heurística), cria os cortes e gera prévias 540x960 com legendas embutidas (ASS com destaque por palavra, `ass.ts`) via FFmpeg (`render.ts`).
4. `POST /api/v1/shorts/:id/render` renderiza o MP4 final 1080x1920 (marca d'água quando o usuário não é assinante nem usou créditos).
5. Arquivos ficam em `./storage` e são servidos com autenticação por `/api/files/...` (suporte a Range para o player).

## Estrutura

- `src/app/(app)/*` páginas autenticadas (dashboard, criar-projeto, projects, renders, editor, quests, forum, convidar, campeonatos, financeiro, brand-kit, templates, analytics, lives, library, schedule, social-media, launcher, connect-ai, settings)
- `src/app/api/v1/*` API REST; `src/app/api/mcp` servidor MCP (JSON-RPC) com token de acesso
- `src/lib/video/*` yt-dlp, transcrição, seleção de momentos, legendas ASS, render FFmpeg, fila
- `prisma/schema.prisma` modelo de dados (SQLite por padrão; troque `DATABASE_URL` para Postgres em produção)

## Produção

- Use Postgres e um storage externo (S3/R2) trocando `storageDir/storageUrl` em `src/lib/video/bin.ts`.
- Rode o pipeline em um processo separado (a fila em memória é por instância).
- Integre um gateway real (Stripe / PIX) no lugar do endpoint de confirmação simulada em `api/v1/orders/[id]/confirm`.

## Efeitos de transformação (identidade própria do corte)

Cada projeto (e cada corte, via override) tem um `EffectsConfig` (`src/lib/effects.ts`) aplicado no render pelo FFmpeg (`src/lib/video/effects.ts`):

| Efeito | O que faz |
|---|---|
| `zoom` `pulse`/`punch` | Zoom dinâmico (respira suave ou corte seco alternado) via `zoompan` |
| `grade` `warm`/`punchy`/`cinematic`/`cool` + `vignette` | Tratamento de cor e vinheta |
| `progressBar` | Barra de progresso na base |
| `handle` | `@canal` fixo no canto |
| `hook` | Gancho visual nos 3 primeiros segundos (hook da IA ou título) |
| `endCardText` | Cartão final ("Segue pra parte 2") nos últimos N segundos |
| `speed` 1.00–1.10 | Velocidade com pitch preservado (`setpts` + `atempo`) |
| `mirror` | Espelha horizontalmente (evite se houver texto na tela) |
| `musicPath` + `musicVolume` | Trilha de fundo em loop mixada no áudio |

Presets prontos: `none`, `viral`, `cinematic`, `monetize`, `stealth` (`EFFECT_PRESETS`). Na API:

```jsonc
// POST /api/v1/projects
{ "url": "...", "clipDuration": "tiktok", "effects": { "preset": "monetize", "handle": "@seucanal" } }
// POST /api/v1/shorts/:id/render — override só deste corte
{ "effects": { "preset": "stealth", "endCardText": "Parte 2 no perfil" } }
```

`clipDuration: "tiktok"` força cortes com **61s+** (exigência do TikTok Creator Rewards), estendendo o fim até a próxima fronteira de frase.

Teste rápido dos presets (gera um vídeo sintético e renderiza cada um em `storage/smoke/`): `npx tsx scripts/smoke-effects.ts`.

> Esses efeitos atendem aos critérios de "transformação significativa" das políticas de monetização (YouTube conteúdo não original, TikTok originalidade). Eles não substituem direitos autorais: um Content ID match ainda pode reivindicar a receita de um vídeo específico.
