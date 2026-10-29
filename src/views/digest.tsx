import type { DigestRow, Night } from '../digest/types.js';

// A row is flagged when it retried 3 or more times or its latest run failed. The marker is
// visible text, so the flag survives without colour.
function flagged(row: DigestRow): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}

export function DigestPage({ night, data }: { night: string; data: Night }) {
  return (
    <>
      <h1>digest {night}</h1>
      {data.badLines > 0 && <p class="warn">{data.badLines} bad lines skipped</p>}
      {data.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>first</th>
              <th>last</th>
              <th>last error</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr class={flagged(row) ? 'flagged warn' : undefined}>
                <td>
                  {flagged(row) && <strong>[!] </strong>}
                  {row.job}
                </td>
                <td>{row.owner ?? '—'}</td>
                <td>{row.runs}</td>
                <td>{row.retries}</td>
                <td>{row.lastStatus}</td>
                <td>{row.firstAt}</td>
                <td>{row.lastAt}</td>
                <td>{row.lastError ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
