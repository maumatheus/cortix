export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootQueue } = await import("./lib/video/queue");
    await bootQueue();
  }
}
