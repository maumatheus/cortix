export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrateSqlite } = await import("./lib/db-migrate");
    await migrateSqlite();
    const { bootQueue } = await import("./lib/video/queue");
    await bootQueue();
  }
}
