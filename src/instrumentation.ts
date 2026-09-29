export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrateSqlite } = await import("./lib/db-migrate");
    await migrateSqlite();
    const { bootQueue } = await import("./lib/video/queue");
    await bootQueue();
    // posts presos em "publishing" (servidor caiu no meio do upload) viram falha pra o usuário reagendar
    const { db } = await import("./lib/db");
    // (envios assíncronos do Upload-Post, com externalId "req:", continuam sendo acompanhados)
    await db.scheduledPost.updateMany({ where: { status: "publishing", NOT: { externalId: { startsWith: "req:" } } }, data: { status: "failed", error: "O Cortix foi fechado durante o envio. Reagende o post." } }).catch(() => {});
    // publica os agendamentos vencidos mesmo sem ninguém abrir a agenda
    const { publishDuePosts } = await import("./lib/publisher");
    const tick = () => publishDuePosts().catch((e) => console.error("[publisher]", (e as Error).message));
    setTimeout(tick, 15_000);
    setInterval(tick, 60_000);
  }
}
