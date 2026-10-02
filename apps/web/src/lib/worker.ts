import "server-only";
import { env } from "./env";

/**
 * Free hosts (e.g. Render) put the worker to sleep when idle, which also pauses the queue consumer.
 * Poke it when work arrives or a guest shows up, without waiting for the answer.
 */
export function wakeWorker(): void {
  void fetch(`${env().WORKER_URL}/healthz`, { signal: AbortSignal.timeout(60_000) }).catch(() => undefined);
}
