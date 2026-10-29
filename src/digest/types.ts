// Contract for the morning digest (plan.md section 1). The reader implements ReadNight;
// the page, JSON and board routes import these types.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job in runs/<night>.jsonl.
export type DigestRow = {
  job: string;
  // null stays null here; the view renders it as the missing-data dash.
  owner: string | null;
  // Lines logged for this job, whatever their status.
  runs: number;
  // Lines with status "retry".
  retries: number;
  // Status of the job's latest line.
  lastStatus: RunStatus;
  // Most recent `error` logged for the job, even if a later run succeeded. null if none.
  lastError: string | null;
  // `at` of the job's earliest and latest lines, as the log's ISO strings with offset.
  firstAt: string;
  lastAt: string;
};

export type Night = {
  // Sorted by job, so the page and the JSON list rows in the same order.
  rows: DigestRow[];
  // Lines that did not parse into a run. Counted, never thrown.
  badLines: number;
};

// Returns null when runs/<night>.jsonl does not exist (or night is not YYYY-MM-DD): routes
// answer 404. An empty file returns { rows: [], badLines: 0 }: the page shows "nothing ran".
export type ReadNight = (runsDir: string, night: string) => Night | null;
