/**
 * Teste da trava eleitoral (COR-2): regras do canal "politica" em schedule-rules
 * e bloqueio no publicador na hora de publicar (sem rede).
 * Uso: npx tsx scripts/smoke-trava-eleitoral.ts
 */
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { migrateSqlite } from "../src/lib/db-migrate";
import { airTimes, canBoost, channelBlackout, postChannels, resolveChannel, validateChannelSchedule, validatePostChannels } from "../src/lib/schedule-rules";
import { publishDuePosts } from "../src/lib/publisher";
import { newId } from "../src/lib/ids";

const sp = (s: string) => new Date(`${s}-03:00`); // horário de São Paulo

async function main() {
  // canal e apelidos
  assert.equal(resolveChannel("Politica", null), "politica");
  assert.equal(resolveChannel(null, "missao-resumo"), "politica");
  assert.equal(resolveChannel("fase-secreta", "politica"), "fase-secreta", "a conta manda sobre o usuário");
  assert.equal(resolveChannel(null, null), null);

  // janelas: 03/10 00:00 → 04/10 20:00 e 24/10 00:00 → 25/10 20:00 (America/Sao_Paulo)
  const bloqueados = ["2026-10-03T00:00:00", "2026-10-03T12:00:00", "2026-10-04T19:59:59", "2026-10-24T00:00:00", "2026-10-25T19:59:00"];
  const liberados = ["2026-10-02T23:59:59", "2026-10-04T20:00:00", "2026-10-23T23:59:00", "2026-10-25T20:00:00", "2026-11-01T10:00:00"];
  for (const s of bloqueados) assert.ok(channelBlackout("politica", sp(s)), `deveria bloquear ${s}`);
  for (const s of liberados) assert.equal(channelBlackout("politica", sp(s)), null, `deveria liberar ${s}`);
  // 03/10 00:30 em SP = 03:30 UTC; 02/10 22:00 em SP = 03/10 01:00 UTC (não pode confundir fuso)
  assert.ok(channelBlackout("politica", new Date("2026-10-03T03:30:00Z")));
  assert.equal(channelBlackout("politica", new Date("2026-10-03T01:00:00Z")), null);
  // outros canais e sem canal não têm trava
  for (const c of ["fase-secreta", null]) assert.equal(channelBlackout(c, sp("2026-10-03T12:00:00")), null);

  const err = validateChannelSchedule("missao-resumo", [sp("2026-10-01T10:00:00"), sp("2026-10-24T09:00:00")]);
  assert.match(err ?? "", /Trava eleitoral/);
  assert.match(err ?? "", /25\/10/);
  assert.equal(validateChannelSchedule("politica", [sp("2026-10-05T10:00:00")]), null);

  // impulsionamento: nunca no canal de política
  assert.equal(canBoost("politica"), false);
  assert.equal(canBoost("missao-resumo"), false);
  assert.equal(canBoost("fase-secreta"), true);
  assert.equal(canBoost("fase-secreta", "missao-resumo"), false, "um canal sem boost já proíbe");

  // trava dura: conta marcada com outro canal NÃO desliga a trava do usuário de política (e vice-versa)
  assert.deepEqual(postChannels("fase-secreta", "missao-resumo"), ["fase-secreta", "politica"]);
  assert.match(validatePostChannels("fase-secreta", "politica", [sp("2026-10-03T12:00:00")]) ?? "", /Trava eleitoral/);
  assert.match(validatePostChannels("politica", "fase-secreta", [sp("2026-10-03T12:00:00")]) ?? "", /Trava eleitoral/);
  assert.equal(validatePostChannels("fase-secreta", null, [sp("2026-10-03T12:00:00")]), null);

  // YouTube: sobe antes da janela mas o publishAt cai dentro → bloqueia
  const antes = sp("2026-10-02T21:00:00");
  assert.equal(airTimes(antes, null).length, 1);
  assert.match(validatePostChannels(null, "politica", airTimes(antes, { youtube: { publishAt: "2026-10-03T00:30:00-03:00" } })) ?? "", /Trava eleitoral/);
  assert.equal(validatePostChannels(null, "politica", airTimes(antes, { youtube: { publishAt: "2026-10-02T23:30:00-03:00" } })), null);

  // publicador: post vencido de conta "politica" não sai durante a janela.
  // Usuário descartável: o "now" do teste é futuro e não pode publicar posts de verdade.
  await migrateSqlite();
  const tag = newId();
  const user = await db.user.create({ data: { id: tag, name: "smoke trava", email: `smoke-trava-${tag}@local`, passwordHash: "x", referralCode: `T${tag.slice(-10)}` } });
  const userPol = await db.user.create({ data: { id: newId(), name: "smoke trava pol", email: `smoke-trava-pol-${tag}@local`, passwordHash: "x", referralCode: `P${tag.slice(-10)}`, channel: "politica" } });
  const accDisfarce = await db.socialAccount.create({ data: { id: newId(), userId: userPol.id, platform: "tiktok", handle: "@smoke-disfarce-" + Date.now(), channel: "fase-secreta" } });
  const acc = await db.socialAccount.create({ data: { id: newId(), userId: user.id, platform: "tiktok", handle: "@smoke-trava-" + Date.now(), channel: "politica" } });
  const accLivre = await db.socialAccount.create({ data: { id: newId(), userId: user.id, platform: "tiktok", handle: "@smoke-livre-" + Date.now(), channel: "fase-secreta" } });
  const quando = sp("2026-10-03T09:00:00");
  const bloqueado = await db.scheduledPost.create({ data: { id: newId(), userId: user.id, socialAccountId: acc.id, platform: "tiktok", caption: "trava", scheduledAt: new Date(quando.getTime() - 60_000) } });
  const disfarce = await db.scheduledPost.create({ data: { id: newId(), userId: userPol.id, socialAccountId: accDisfarce.id, platform: "tiktok", caption: "disfarce", scheduledAt: new Date(quando.getTime() - 60_000) } });
  // sobe antes da janela, mas o YouTube soltaria dentro dela
  const ytAntes = await db.scheduledPost.create({ data: { id: newId(), userId: userPol.id, platform: "youtube", caption: "yt", scheduledAt: sp("2026-10-02T21:00:00"), meta: JSON.stringify({ youtube: { publishAt: "2026-10-03T00:30:00-03:00" } }) } });
  const livre = await db.scheduledPost.create({ data: { id: newId(), userId: user.id, socialAccountId: accLivre.id, platform: "tiktok", caption: "livre", scheduledAt: new Date(quando.getTime() - 60_000) } });
  try {
    // 02/10 21:00 está fora da janela: só o publishAt (03/10 00:30) pode barrar o post do YouTube
    const r0 = await publishDuePosts(userPol.id, { now: sp("2026-10-02T21:00:00") });
    assert.equal(r0.blocked, 1);
    const r = await publishDuePosts(user.id, { now: quando });
    const r2 = await publishDuePosts(userPol.id, { now: quando });
    for (const id of [disfarce.id, ytAntes.id]) {
      const p = await db.scheduledPost.findUnique({ where: { id } });
      assert.equal(p?.status, "failed", `post ${p?.caption} deveria ter sido barrado`);
      assert.match(p?.error ?? "", /Trava eleitoral/);
    }
    assert.ok(r2.blocked >= 1);
    const b = await db.scheduledPost.findUnique({ where: { id: bloqueado.id } });
    const l = await db.scheduledPost.findUnique({ where: { id: livre.id } });
    assert.equal(b?.status, "failed");
    assert.match(b?.error ?? "", /Trava eleitoral/);
    assert.equal(l?.status, "published", "canal sem trava publica normalmente");
    assert.ok(r.blocked >= 1);
    console.log("ok: post bloqueado com:", b?.error);
  } finally {
    await db.scheduledPost.deleteMany({ where: { id: { in: [bloqueado.id, livre.id, disfarce.id, ytAntes.id] } } });
    await db.user.deleteMany({ where: { id: { in: [user.id, userPol.id] } } }); // cascade: contas e posts
  }
  console.log("smoke-trava-eleitoral: tudo certo");
}

main().finally(() => db.$disconnect());
