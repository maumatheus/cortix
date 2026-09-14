/* Popula missões, campeonatos de exemplo e um post inicial da comunidade. Rode: npm run seed */
import { PrismaClient } from "@prisma/client";
import { ulid } from "ulid";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const id = () => ulid().toLowerCase();

const MISSIONS = [
  { key: "checkin", title: "Faça seu check-in", description: "Volte à área de missões todo dia para realizar o check-in e receber a recompensa.", reward: 5, kind: "daily", sortOrder: 1 },
  { key: "streak7", title: "Construa sua sequência", description: "Acumule 7 dias consecutivos de check-in e ganhe um bônus.", reward: 30, kind: "once", sortOrder: 2 },
  { key: "first_project", title: "Crie seu primeiro projeto", description: "Cole um link e gere seus primeiros cortes.", reward: 20, kind: "once", sortOrder: 3 },
  { key: "first_render", title: "Renderize um corte", description: "Baixe um corte em MP4 com legendas embutidas.", reward: 15, kind: "once", sortOrder: 4 },
  { key: "brand_kit", title: "Monte seu Brand Kit", description: "Cadastre suas cores, fonte e @ para usar em todos os cortes.", reward: 10, kind: "once", sortOrder: 5 },
  { key: "invite", title: "Convide um amigo", description: "Compartilhe seu link de convite e ganhe quando ele fizer a primeira compra.", reward: 10, kind: "once", sortOrder: 6 },
  { key: "forum_post", title: "Participe da comunidade", description: "Publique uma dica ou pergunta no fórum.", reward: 10, kind: "once", sortOrder: 7 },
  { key: "schedule", title: "Agende uma publicação", description: "Programe um corte para sair no melhor horário.", reward: 10, kind: "once", sortOrder: 8 },
];

async function main() {
  for (const m of MISSIONS) {
    await db.mission.upsert({ where: { key: m.key }, update: { title: m.title, description: m.description, reward: m.reward, kind: m.kind, sortOrder: m.sortOrder }, create: { id: id(), ...m } });
  }

  const now = new Date();
  const day = 86400_000;
  const champs = [
    { title: "Campeonato Podcast Semanal", organizer: "CORTIX", kind: "cpm", status: "active", start: -5, end: 25, prizeTotal: 390_000, ratePer1000: 350, budgetUsedPct: 13.8, description: "Faça cortes dos episódios do podcast parceiro e receba por views válidas. Formato vertical 9:16, plataformas TikTok, Reels e Shorts. Use a hashtag #cortix na legenda." },
    { title: "Campeonato Stream Gamer", organizer: "CORTIX", kind: "cpm", status: "active", start: -40, end: 100, prizeTotal: 260_000, ratePer1000: 100, budgetUsedPct: 32.6, description: "Cortes das lives do streamer parceiro. Vale VOD e clipes oficiais. Conteúdo roubado de outro clipador não paga." },
    { title: "Academia de Negócios", organizer: "CORTIX", kind: "cpm", status: "active", start: -60, end: 60, prizeTotal: 18_274, ratePer1000: 50, budgetUsedPct: 1.8, description: "Cortes de aulas e palestras de empreendedorismo. Marque o perfil oficial e use #cortix." },
    { title: "Campeonato Ranking Creator", organizer: "CORTIX", kind: "ranking", status: "active", start: -3, end: 57, prizeTotal: 22_200_000, budgetUsedPct: 0, description: "R$ 222.000 em premiação, 60 dias, duas categorias (CLIP e EDIT). Conta a view que o vídeo GANHA depois de registrado. Mínimo de 100.000 views ganhas para entrar no ranking. Tabela: 1º R$ 30.000 · 2º R$ 18.000 · 3º R$ 12.000 · 4º R$ 9.000 · 5º R$ 7.000 · 6º R$ 6.000 · 7º R$ 5.000 · 8º R$ 4.500 · 9º R$ 4.000 · 10º R$ 3.500 · 11º–15º R$ 2.400. Hashtags obrigatórias e marca d'água com o canal oficial. Pagamento via PIX em até 30 dias após o fim." },
    { title: "Campeonato Comediante RJ", organizer: "CORTIX", kind: "ranking", status: "active", start: -14, end: 16, prizeTotal: 1_000_000, budgetUsedPct: 0, description: "Premiação total de R$ 10.000, distribuída UMA VEZ no fim da edição. Ranking atualizado diariamente. Mínimo de 100.000 views ganhas. Tabela: 1º R$ 2.500 · 2º R$ 1.800 · 3º R$ 1.400 · 4º R$ 1.100 · 5º R$ 900 · 6º R$ 750 · 7º R$ 600 · 8º R$ 450 · 9º R$ 300 · 10º R$ 200. Pagamento via PIX em até 7 dias." },
    { title: "Campeonato Streamer Kosmo", organizer: "CORTIX", kind: "ranking", status: "active", start: -14, end: 16, prizeTotal: 1_000_000, budgetUsedPct: 0, description: "Vale todo conteúdo que envolva o streamer: live, VOD, entrevista, podcast, participação. Premiação total de R$ 10.000 no fim da edição. Mínimo de 100.000 views ganhas." },
    { title: "Campeonato Podcast 3.0", organizer: "PARCEIRO", kind: "ranking", status: "active", start: -75, end: 16, prizeTotal: 1_000_000, budgetUsedPct: 0, description: "Período mensal, fechamento no último dia de cada mês. Conta a view ganha dentro do mês. R$ 8.500 para o top 10 + R$ 1.500 em mini-campanhas. Só vale conteúdo de 2026 em diante." },
    { title: "Campeonato eSports 2026", organizer: "CORTIX", kind: "cpm", status: "budget_exhausted", start: -54, end: 8, prizeTotal: 1_500_000, ratePer1000: 100, budgetUsedPct: 100, description: "Orçamento esgotado. Obrigado a todos os creators!" },
    { title: "[ENCERRADO] Palestrante Social", organizer: "CORTIX", kind: "ranking", status: "finished", start: -56, end: -12, prizeTotal: 1_000_000, budgetUsedPct: 100, description: "Edição encerrada. Premiação apurada e paga via PIX." },
  ];
  const existing = await db.championship.count();
  if (existing === 0) {
    for (const c of champs) {
      await db.championship.create({
        data: {
          id: id(),
          title: c.title,
          organizer: c.organizer,
          description: c.description,
          kind: c.kind,
          status: c.status,
          startDate: new Date(now.getTime() + c.start * day),
          endDate: new Date(now.getTime() + c.end * day),
          prizeTotal: c.prizeTotal,
          ratePer1000: c.ratePer1000 ?? null,
          budgetUsedPct: c.budgetUsedPct,
        },
      });
    }
  }

  let staff = await db.user.findUnique({ where: { email: "equipe@cortix.app" } });
  if (!staff) {
    staff = await db.user.create({
      data: { id: id(), name: "Equipe Cortix", email: "equipe@cortix.app", passwordHash: await bcrypt.hash(ulid(), 10), referralCode: "CORTIX", credits: 0 },
    });
  }
  const posts = await db.forumPost.count();
  if (posts === 0) {
    await db.forumPost.create({
      data: {
        id: id(),
        userId: staff.id,
        category: "dicas",
        title: "[TUTORIAL] Fiquei com 0 views! Como limpar a conta e sair do shadowban",
        content:
          "Fala, creators! Se seus vídeos não passam de 0 views, a primeira coisa é limpar a conta.\n\n🛠️ Passo a passo:\n1. Abra o TikTok Studio pelo celular.\n2. Vá em Mais Ferramentas › Status da Conta.\n3. Veja a lista de vídeos com Publicação Restrita.\n4. NÃO apague: mude a privacidade para Somente Você.\n\n👑 Caso extremo: grave um vídeo curto original pela câmera do app, poste sem edição, espere passar de 10 views e só então volte a postar seus cortes.\n\nDeixa o UP pra ajudar mais gente!",
        upvotes: 5,
      },
    });
    await db.forumPost.create({
      data: {
        id: id(),
        userId: staff.id,
        category: "geral",
        title: "Bem-vindo à comunidade Cortix 👋",
        content: "Troque estratégias, tire dúvidas e compartilhe aprendizados com quem também vive de criar conteúdo. Use as categorias para organizar: Geral, Dicas, TikTok, Instagram, YouTube, Ideias e Perguntas.",
        upvotes: 12,
      },
    });
  }
  console.log("Seed concluído.");
}

main().finally(() => db.$disconnect());
