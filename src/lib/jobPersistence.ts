/**
 * jobPersistence.ts — Durable on-disk store for render jobs.
 *
 * Backs the in-memory job Map in renderQueue.ts with a JSON file so that
 * job status (and render history) survives `pm2 restart` / server redeploys.
 * Single-process, low write-frequency use case — a plain JSON file with a
 * write queue (to avoid interleaved writes) is enough; no DB needed.
 */

import path from "path";
import { mkdir, readFile, writeFile, rename } from "fs/promises";

const DATA_DIR = path.join(process.cwd(), "data");

// Separate write queues per file so concurrent writers (renderQueue, veoQueue)
// never interleave/corrupt each other's chained writes.
const writeQueues = new Map<string, Promise<void>>();

export async function loadPersistedJobs<T>(filename = "jobs.json"): Promise<Record<string, T>> {
  try {
    const raw = await readFile(path.join(DATA_DIR, filename), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function persistJobs<T>(jobs: Record<string, T>, filename = "jobs.json"): Promise<void> {
  const filePath = path.join(DATA_DIR, filename);
  const prev = writeQueues.get(filename) || Promise.resolve();
  const next = prev
    .then(async () => {
      await mkdir(DATA_DIR, { recursive: true });
      const tmpFile = `${filePath}.tmp`;
      await writeFile(tmpFile, JSON.stringify(jobs));
      await rename(tmpFile, filePath); // atomic on POSIX filesystems
    })
    .catch((err) => {
      console.error(`[jobPersistence] Failed to persist ${filename}:`, err?.message);
    });
  writeQueues.set(filename, next);
  return next;
}
