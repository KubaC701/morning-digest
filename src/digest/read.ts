import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunStatus } from './types.js';

type Run = {
  at: string;
  time: number;
  job: string;
  status: RunStatus;
  owner: string | null;
  error: string | null;
};

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

// One log line into a run, or null when it is not one (bad JSON, missing or wrong fields).
function parseRun(line: string): Run | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const { at, job, status, owner, error } = v;
  if (typeof at !== 'string' || typeof job !== 'string' || job === '') return null;
  const time = Date.parse(at);
  if (Number.isNaN(time)) return null;
  if (typeof status !== 'string' || !STATUSES.includes(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && error !== null && typeof error !== 'string') return null;
  return { at, time, job, status: status as RunStatus, owner, error: error ?? null };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  const file = join(runsDir, `${night}.jsonl`);
  if (!existsSync(file)) return null;

  let badLines = 0;
  const byJob = new Map<string, Run[]>();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    const run = parseRun(line);
    if (!run) {
      badLines++;
      continue;
    }
    const runs = byJob.get(run.job);
    if (runs) runs.push(run);
    else byJob.set(run.job, [run]);
  }

  const rows: DigestRow[] = [...byJob.entries()].map(([job, runs]) => {
    // Order by instant, not by string: offsets can differ between lines. Ties keep file order.
    const ordered = [...runs].sort((a, b) => a.time - b.time);
    const first = ordered[0]!;
    const last = ordered[ordered.length - 1]!;
    const lastError = ordered.findLast((r) => r.error !== null)?.error ?? null;
    return {
      job,
      owner: last.owner,
      runs: runs.length,
      retries: runs.filter((r) => r.status === 'retry').length,
      lastStatus: last.status,
      lastError,
      firstAt: first.at,
      lastAt: last.at,
    };
  });
  rows.sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));

  return { rows, badLines };
};
