import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

// counts is null when the night cannot be read, rendered as the missing-data dash.
export type NightSummary = {
  night: string;
  counts: { ok: number; retry: number; fail: number } | null;
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// One job = one count: each digest row is counted once, by its lastStatus. Derived from
// readNight so the board and the digest page cannot disagree.
function summarize(runsDir: string, night: string): NightSummary {
  const data = readNight(runsDir, night);
  if (!data) return { night, counts: null };
  const counts = { ok: 0, retry: 0, fail: 0 };
  for (const row of data.rows) counts[row.lastStatus] += 1;
  return { night, counts };
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((n) => summarize(config.runsDir, n)),
  };
}
