import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const night = readNight('runs', '2026-10-28');

function row(job: string) {
  const found = night?.rows.find((r) => r.job === job);
  if (!found) throw new Error(`no row for ${job}`);
  return found;
}

describe('readNight on runs/2026-10-28.jsonl', () => {
  it('gives one row per job, sorted by job, and counts the bad line', () => {
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night?.badLines).toBe(1);
  });

  it('counts retries and keeps the status of the latest run', () => {
    expect(row('fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('keeps first and last time with the offset from the log', () => {
    const sync = row('lane/sync');
    expect(sync.runs).toBe(8);
    expect(sync.retries).toBe(1);
    expect(sync.lastError).toBe('lock held');
    expect(sync.firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(sync.lastAt).toBe('2026-10-29T05:00:04+01:00');
  });

  it('reports a failed job with its error', () => {
    const backup = row('notes/backup');
    expect(backup.lastStatus).toBe('fail');
    expect(backup.lastError).toBe('quota exceeded');
    expect(backup.owner).toBe('lane-07');
  });

  it('keeps a job whose owner is null', () => {
    const render = row('digest/render');
    expect(render.owner).toBeNull();
    expect(render.lastStatus).toBe('ok');
    expect(render.lastError).toBeNull();
  });
});

describe('readNight edge cases', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('returns null for a night with no log', () => {
    expect(readNight('runs', '2026-01-01')).toBeNull();
  });

  it('returns null for a night that is not YYYY-MM-DD', () => {
    expect(readNight('runs', '../2026-10-28')).toBeNull();
  });

  it('returns no rows and no bad lines for an empty log', () => {
    dir = mkdtempSync(join(tmpdir(), 'rig-read-'));
    writeFileSync(join(dir, '2026-10-30.jsonl'), '');
    expect(readNight(dir, '2026-10-30')).toEqual({ rows: [], badLines: 0 });
  });
});
