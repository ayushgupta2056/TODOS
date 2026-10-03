import "server-only";
import { env } from "./env";

/**
 * Free hosts (e.g. Render) put the worker to sleep when idle, which also pauses the queue consumer.
 * Poke it when work arrives or a guest shows up. The request only has to reach the host to
 * trigger a cold start, so a short timeout is enough; awaiting it makes sure it is actually sent.
 */
export async function wakeWorker(timeoutMs = 4000): Promise<void> {
  await fetch(`${env().WORKER_URL}/healthz`, { signal: AbortSignal.timeout(timeoutMs) }).catch(() => undefined);
}
