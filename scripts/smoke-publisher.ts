/**
 * Smoke test do publicador real (sem rede): state OAuth assinado, textos do Short e
 * um post numa conta OAuth sem render (tem que virar "failed" com mensagem clara).
 * Uso: npx tsx scripts/smoke-publisher.ts
 */
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { signState, verifyState } from "../src/lib/social/config";
import { publishDuePosts, youtubeTexts } from "../src/lib/publisher";
import { newId } from "../src/lib/ids";

async function main() {
  const st = signState("user-123");
  assert.equal(verifyState(st), "user-123");
  assert.equal(verifyState(st.slice(0, -2) + "xx"), null, "assinatura adulterada");
  assert.equal(verifyState(signState("u", -1000)), null, "state expirado");
  assert.equal(verifyState(null), null);

  const t = youtubeTexts("Como ganhar dinheiro com cortes\nFala sério #financas #negocios", "fallback");
  assert.equal(t.title, "Como ganhar dinheiro com cortes");
  assert.match(t.description, /#Shorts$/);
  assert.deepEqual(t.tags, ["financas", "negocios"]);
  assert.equal(youtubeTexts("", "Título do corte").title, "Título do corte");
  assert.ok(youtubeTexts("x".repeat(300), "f").title.length <= 100);

  const user = await db.user.findFirst();
  assert.ok(user, "precisa de pelo menos um usuário no banco (npm run seed)");
  const project = await db.project.create({ data: { id: newId(), userId: user.id, title: "smoke publisher" } });
  const short = await db.short.create({ data: { id: newId(), projectId: project.id, title: "corte smoke", startTime: 0, endTime: 30 } });
  const acc = await db.socialAccount.create({ data: { id: newId(), userId: user.id, platform: "youtube", handle: "@smoke-" + Date.now(), connection: "oauth", accessToken: "x", refreshToken: "y", tokenExpiresAt: new Date(Date.now() + 3600_000) } });
  const post = await db.scheduledPost.create({ data: { id: newId(), userId: user.id, shortId: short.id, socialAccountId: acc.id, platform: "youtube", caption: "teste", scheduledAt: new Date(Date.now() - 1000) } });
  const listed = await db.socialAccount.findUnique({ where: { id: acc.id } });
  assert.equal((listed as Record<string, unknown>).accessToken, undefined, "token não pode sair nas consultas padrão");
  try {
    await publishDuePosts(user.id);
    const after = await db.scheduledPost.findUnique({ where: { id: post.id } });
    assert.equal(after?.status, "failed");
    assert.match(after?.error ?? "", /renderizado/);
    console.log("ok: post sem render falhou com:", after?.error);
  } finally {
    await db.scheduledPost.delete({ where: { id: post.id } });
    await db.socialAccount.delete({ where: { id: acc.id } });
    await db.project.delete({ where: { id: project.id } });
  }
  console.log("smoke-publisher: tudo certo");
}

main().finally(() => db.$disconnect());
