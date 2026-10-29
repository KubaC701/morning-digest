import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('GET /api/digest/:night', () => {
  it('lists the night rows sorted by job, owner null kept as null', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: { job: string; owner: string | null }[]; badLines: number };
    expect(body.rows).toHaveLength(5);
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual([...jobs].sort());
    expect(typeof body.badLines).toBe('number');
    for (const row of body.rows) expect(row.owner === null || typeof row.owner === 'string').toBe(true);
  });

  it('answers 404 JSON for a night with no file', async () => {
    const res = await createApp(config).request('/api/digest/2099-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });
});
