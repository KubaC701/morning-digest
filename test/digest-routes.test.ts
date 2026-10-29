import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'digest-routes-'));
  copyFileSync('runs/2026-10-28.jsonl', join(runsDir, '2026-10-28.jsonl'));
  writeFileSync(join(runsDir, '2026-10-20.jsonl'), '');
  writeFileSync(
    join(runsDir, '2026-10-21.jsonl'),
    [
      '{"at":"2026-10-21T01:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
      'this is not json',
      '{"at":"2026-10-21T02:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
      '{"at":"2026-10-21T03:00:00+01:00","job":"lane/sy',
    ].join('\n'),
  );
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
});

afterAll(() => rmSync(runsDir, { recursive: true, force: true }));

const json = async (night: string) => (await app.request(`/api/digest/${night}`)).json() as Promise<Night>;
const page = async (night: string) => (await app.request(`/digest/${night}`)).text();

describe('GET /digest/:night', () => {
  it('answers 200 with a row per job', async () => {
    const res = await app.request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const job of ['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs']) {
      expect(html).toContain(job);
    }
  });

  it('answers 404 for a night with no file', async () => {
    expect((await app.request('/digest/2099-01-01')).status).toBe(404);
  });

  it('says "nothing ran" for the empty night', async () => {
    const res = await app.request('/digest/2026-10-20');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('stays 200 and shows the bad-line note for a night with a bad line', async () => {
    const res = await app.request('/digest/2026-10-21');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('2 bad lines skipped');
    expect(html).toContain('lane/sync');
  });

  it('marks fixtures/refresh and notes/backup, and shows a dash for the missing owner', async () => {
    const html = await page('2026-10-28');
    expect(html).toContain('[!] </strong>fixtures/refresh');
    expect(html).toContain('[!] </strong>notes/backup');
    expect(html).not.toContain('[!] </strong>lane/sync');
    const renderRow = html.split('<tr').find((r) => r.includes('digest/render')) ?? '';
    expect(renderRow).toContain('<td>—</td>');
  });
});

describe('GET /api/digest/:night', () => {
  it('answers 200 with rows sorted by job and null owner kept', async () => {
    const res = await app.request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toHaveLength(5);
    expect(jobs).toEqual([...jobs].sort());
    expect(body.rows.find((r) => r.job === 'digest/render')?.owner).toBeNull();
  });

  it('answers 404 JSON for a night with no file', async () => {
    const res = await app.request('/api/digest/2099-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('returns empty rows for the empty night', async () => {
    const res = await app.request('/api/digest/2026-10-20');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rows: [], badLines: 0 });
  });

  it('counts bad lines and still answers 200', async () => {
    const res = await app.request('/api/digest/2026-10-21');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.badLines).toBe(2);
    expect(body.rows.map((r) => r.job)).toEqual(['lane/sync']);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const html = await page('2026-10-28');
    const { rows } = await json('2026-10-28');
    const pageJobs = [...html.matchAll(/<td>(?:<strong>\[!\] <\/strong>)?([a-z]+\/[a-z-]+)<\/td>/g)].map((m) => m[1]);
    expect(pageJobs).toEqual(rows.map((r) => r.job));
  });
});
