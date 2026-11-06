#!/usr/bin/env node
// Synthetic test for scripts/watch.mjs.
//
// No network and no real tracker: a fake `gh` serves issue fixtures, and the
// test walks the cursor through baseline, new issue, untrusted comment, trusted
// comment, body edit, lifecycle label and corrupt state.
//
// Usage: node tests/git-issue-agent/test-watch.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { github } from '../../.agents/skills/git-issue-agent/scripts/providers/github.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SKILL_DIR = path.join(REPO_ROOT, '.agents', 'skills', 'git-issue-agent');
const WATCH = path.join(SKILL_DIR, 'scripts', 'watch.mjs');
const DELIVER = path.join(SKILL_DIR, 'scripts', 'deliver.mjs');
const AGENT = path.join(SKILL_DIR, 'scripts', 'agent.mjs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'gia-watch-'));
const BIN = path.join(TMP, 'bin');
const FIX = path.join(TMP, 'fixtures');
const CONFIG = path.join(TMP, 'config.jsonc');
const STATE = path.join(TMP, 'state.watch.json');
const QUEUE_LOG = path.join(FIX, 'queue.jsonl');
const LIST_LOG = path.join(FIX, 'list.log');

fs.mkdirSync(BIN, { recursive: true });
fs.mkdirSync(FIX, { recursive: true });

let passed = 0;
function ok(name) {
  passed += 1;
  console.log(`PASS ${name}`);
}

function run(args, { env = {} } = {}) {
  const result = spawnSync(process.execPath, [WATCH, ...args], {
    cwd: TMP,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${BIN}:${process.env.PATH}`,
      GIT_ISSUE_AGENT_CONFIG: CONFIG,
      GIT_ISSUE_AGENT_HOME: TMP,
      FAKE_DIR: FIX,
      ...env,
    },
  });
  return { code: result.status, out: result.stdout.trim(), err: result.stderr.trim() };
}

function write(file, value) {
  fs.writeFileSync(file, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
}

function issue(number, overrides = {}) {
  return {
    number,
    title: `issue ${number}`,
    author: { login: 'reisi007' },
    labels: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    url: `https://example.test/issues/${number}`,
    ...overrides,
  };
}

function view(number, overrides = {}) {
  const item = issue(number, overrides);
  return {
    number,
    title: item.title,
    body: overrides.body ?? `body ${number}`,
    author: item.author,
    labels: item.labels,
    url: item.url,
    updatedAt: item.updatedAt,
    state: 'OPEN',
    comments: overrides.comments ?? [],
  };
}

function saveIssues(items) {
  write(path.join(FIX, 'issues.json'), items);
  const pages = [];
  for (let offset = 0; offset < items.length; offset += 100) {
    pages.push(items.slice(offset, offset + 100).map((item) => ({
      number: item.number,
      title: item.title,
      user: item.author ? { login: item.author.login ?? item.author } : null,
      labels: (item.labels ?? []).map((label) => (
        typeof label === 'string' ? { name: label } : { name: label.name }
      )),
      created_at: item.createdAt ?? null,
      updated_at: item.updatedAt ?? null,
      html_url: item.url ?? null,
      body: item.body ?? '',
    })));
  }
  write(path.join(FIX, 'issue-pages.json'), pages);
}

function saveView(number, overrides = {}) {
  write(path.join(FIX, `issue-${number}.json`), view(number, overrides));
}

function runAgent(args, { env = {} } = {}) {
  const result = spawnSync(process.execPath, [AGENT, ...args], {
    cwd: TMP,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${BIN}:${process.env.PATH}`,
      GIT_ISSUE_AGENT_CONFIG: CONFIG,
      GIT_ISSUE_AGENT_HOME: TMP,
      FAKE_DIR: FIX,
      ...env,
    },
  });
  return { code: result.status, out: result.stdout.trim(), err: result.stderr.trim() };
}

function runDeliver(args, { env = {} } = {}) {
  const result = spawnSync(process.execPath, [DELIVER, ...args], {
    cwd: TMP,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      PATH: `${BIN}:${process.env.PATH}`,
      GIT_ISSUE_AGENT_CONFIG: CONFIG,
      GIT_ISSUE_AGENT_HOME: TMP,
      FAKE_DIR: FIX,
      ...env,
    },
  });
  return { code: result.status, out: result.stdout.trim(), err: result.stderr.trim() };
}

function runGh(args, { env = {} } = {}) {
  const result = spawnSync('gh', args, {
    cwd: TMP,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${BIN}:${process.env.PATH}`,
      FAKE_DIR: FIX,
      ...env,
    },
  });
  return { code: result.status, out: result.stdout.trim(), err: result.stderr.trim() };
}

function withFakeGhEnv(env, operation) {
  const previous = new Map(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  try {
    return operation();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function runAsync(args, { env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [WATCH, ...args], {
      cwd: TMP,
      env: {
        ...process.env,
        PATH: `${BIN}:${process.env.PATH}`,
        GIT_ISSUE_AGENT_CONFIG: CONFIG,
        GIT_ISSUE_AGENT_HOME: TMP,
        FAKE_DIR: FIX,
        ...env,
      },
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });
}

function runDeliverAsync(args, { env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [DELIVER, ...args], {
      cwd: TMP,
      env: {
        ...process.env,
        PATH: `${BIN}:${process.env.PATH}`,
        GIT_ISSUE_AGENT_CONFIG: CONFIG,
        GIT_ISSUE_AGENT_HOME: TMP,
        FAKE_DIR: FIX,
        ...env,
      },
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });
}

function ack(deliveryId) {
  const result = run(['--ack', deliveryId]);
  assert.equal(result.code, 0, `acknowledging ${deliveryId} failed: ${result.err}`);
}

// --- fake gh ---------------------------------------------------------------

write(path.join(BIN, 'gh'), `#!/usr/bin/env bash
case "$1 $2" in
  "api user") echo "\${FAKE_GH_USER:-reisi007}" ;;
  "api repos/"*)
    if [ -n "\${FAKE_LIST_LOG:-}" ]; then echo start >> "$FAKE_LIST_LOG"; fi
    if [ -n "\${FAKE_LIST_LOG:-}" ]; then echo "request:$2" >> "$FAKE_LIST_LOG"; fi
    if [ -n "\${FAKE_LIST_DELAY:-}" ]; then sleep "$FAKE_LIST_DELAY"; fi
    if [ -n "\${FAKE_LIST_LOG:-}" ]; then echo end >> "$FAKE_LIST_LOG"; fi
    if [ "\${FAKE_GH_OVERSIZE:-0}" = "1" ]; then head -c 9437184 /dev/zero; exit 0; fi
    node - "$FAKE_DIR/issue-pages.json" "$2" <<'NODE'
const fs = require('node:fs');
const pages = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const endpoint = process.argv[3];
const match = endpoint.match(/[?&]page=(\\d+)/);
const rows = pages[(Number(match?.[1] ?? 1) - 1)] ?? [];
console.log(JSON.stringify(rows.map((issue) => ({
  number: issue.number,
  title: issue.title,
  author: issue.user ? { login: issue.user.login ?? null } : null,
  labels: (issue.labels ?? []).map((label) => label.name),
  createdAt: issue.created_at ?? null,
  updatedAt: issue.updated_at ?? null,
  url: issue.html_url ?? null,
  isPullRequest: issue.pull_request != null,
}))));
NODE
    ;;
  "issue list")
    if [ -n "\${FAKE_LIST_LOG:-}" ]; then echo start >> "$FAKE_LIST_LOG"; fi
    if [ -n "\${FAKE_LIST_DELAY:-}" ]; then sleep "$FAKE_LIST_DELAY"; fi
    if [ -n "\${FAKE_LIST_LOG:-}" ]; then echo end >> "$FAKE_LIST_LOG"; fi
    cat "$FAKE_DIR/issues.json" ;;
  "issue view") cat "$FAKE_DIR/issue-$3.json" ;;
  "pr list") cat "$FAKE_DIR/prs.json" ;;
  "pr view")
    if [ "\${FAKE_PR_MODE:-ok}" = "flip" ]; then
      if [ -e "$FAKE_DIR/head-flip" ]; then cat "$FAKE_DIR/pr-view-flipped.json";
      else touch "$FAKE_DIR/head-flip"; cat "$FAKE_DIR/pr-view.json"; fi
    else cat "$FAKE_DIR/pr-view.json"; fi
    ;;
  "pr checks")
    if [ "$3" != "\${FAKE_ASSOCIATED_PR:-9}" ]; then
      echo "checks requested for an unrelated PR: $3" >&2
      exit 91
    fi
    if [[ "$*" == *"--watch"* && "$*" == *"--json"* ]]; then
      echo "cannot use --watch with --json" >&2
      exit 1
    fi
    if [[ "$*" == *"--watch"* ]]; then exit "\${FAKE_WATCH_EXIT:-0}"; fi
    echo "\${FAKE_CHECKS_JSON:-[]}"
    exit "\${FAKE_CHECKS_EXIT:-0}"
    ;;
  *) echo "unexpected gh call: $*" >&2; exit 1 ;;
esac
`);
fs.chmodSync(path.join(BIN, 'gh'), 0o755);

write(path.join(BIN, 'opencode'), `#!/usr/bin/env bash
if [ "$1 $2" != "api post" ] || [ "$4" != "--data" ]; then
  echo "unexpected opencode call: $*" >&2
  exit 92
fi
if [ -n "\${FAKE_OPENCODE_FAIL_ON:-}" ]; then
  count=0
  if [ -f "$FAKE_DIR/opencode-attempts" ]; then count=$(cat "$FAKE_DIR/opencode-attempts"); fi
  count=$((count + 1))
  echo "$count" > "$FAKE_DIR/opencode-attempts"
  if [ "$count" = "$FAKE_OPENCODE_FAIL_ON" ]; then exit 1; fi
fi
if [ "\${FAKE_OPENCODE_EXIT:-0}" != "0" ]; then exit "$FAKE_OPENCODE_EXIT"; fi
if [ -n "\${FAKE_OPENCODE_DELAY:-}" ]; then sleep "$FAKE_OPENCODE_DELAY"; fi
printf '%s\\n' "$5" >> "$FAKE_DIR/queue.jsonl"
`);
fs.chmodSync(path.join(BIN, 'opencode'), 0o755);

// --- config ----------------------------------------------------------------

write(CONFIG, `{
  "version": 1,
  "provider": "github",
  "model": "test/model",
  "accounts": ["reisi007"],
  "trusted_authors": ["reisi007"],
  "defaults": {
    "enabled": true,
    "labels": {
      "working": "agent:working",
      "review": "agent:review",
      "done": "agent:done",
      "blocked": "agent:blocked",
      "needs_info": "agent:needs-info",
    },
  },
  "repos": {
    "reisi007/demo": { "account": "reisi007", "enabled": true },
    "reisi007/paused": { "account": "reisi007", "enabled": false },
  },
}
`);

const firstIssue = issue(1, { title: 'baseline issue' });
const secondIssue = issue(2, {
  title: 'untrusted issue',
  author: { login: 'mallory' },
  updatedAt: '2026-01-01T00:00:01Z',
});
const reviewIssue = issue(3, { title: 'already in review', labels: ['agent:review'] });
const doneIssue = issue(4, { title: 'already done', labels: ['agent:done'] });
saveIssues([firstIssue, secondIssue, reviewIssue, doneIssue]);
saveView(1);
write(path.join(FIX, 'pr-view.json'), {
  number: 9,
  state: 'OPEN',
  isDraft: false,
  headRefName: 'fix/one',
  headRefOid: '1111111111111111111111111111111111111111',
  baseRefName: 'main',
  body: 'Closes #8',
  author: { login: 'reisi007' },
  reviews: [],
  comments: [],
});
write(path.join(FIX, 'pr-view-flipped.json'), {
  number: 9,
  state: 'OPEN',
  isDraft: false,
  headRefName: 'fix/one',
  headRefOid: '2222222222222222222222222222222222222222',
  baseRefName: 'main',
  body: 'Closes #8',
  author: { login: 'reisi007' },
  reviews: [],
  comments: [],
});
write(path.join(FIX, 'prs.json'), [
  { number: 9, body: 'Closes #8' },
  { number: 10, body: 'Closes #999' },
]);

// --- baseline --------------------------------------------------------------

const baselineComments = [
  { id: 'IC_BASE_TRUSTED', url: 'https://example.test/comments/1', author: { login: 'reisi007' }, body: 'trusted but older', createdAt: '2026-01-01T00:00:02Z', updatedAt: '2026-01-01T00:00:02Z' },
  { id: 'IC_BASE_UNTRUSTED', url: 'https://example.test/comments/2', author: { login: 'mallory' }, body: 'untrusted and newer', createdAt: '2026-01-01T00:00:03Z', updatedAt: '2026-01-01T00:00:03Z' },
];
saveView(1, { title: 'baseline issue', comments: baselineComments });
let result = run([]);
assert.equal(result.code, 1, `baseline should not wake: ${result.err}`);
assert.equal(result.out, '');
const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));
assert.ok(state.projects['reisi007/demo'].seen['1'], 'baseline records the open issue');
assert.notEqual(state.projects['reisi007/demo'].seen['1'].contentHash, null);
assert.equal(state.projects['reisi007/demo'].seen['1'].lastCommentAt, '2026-01-01T00:00:02Z');
assert.equal(state.projects['reisi007/demo'].seen['1'].trustedComments.length, 1);
ok('first run baselines content and trusted comment timestamp without waking');

const legacyCursor = JSON.parse(fs.readFileSync(STATE, 'utf8'));
delete legacyCursor.projects['reisi007/demo'].seen['1'].contentHash;
write(STATE, legacyCursor);
result = run(['--json']);
assert.equal(result.code, 1, 'a cursor without contentHash should snapshot rather than emit a false edit');
assert.equal(result.out, '');
assert.ok(JSON.parse(fs.readFileSync(STATE, 'utf8')).projects['reisi007/demo'].seen['1'].contentHash,
  'the legacy entry should be upgraded with its current fingerprint');
ok('legacy cursor entries without contentHash are snapshotted without a false edit');

result = run([]);
assert.equal(result.code, 1);
ok('unchanged poll stays silent');

const metadataOnly = issue(1, { title: 'baseline issue', updatedAt: '2026-01-01T00:00:30Z', labels: ['triaged'] });
saveIssues([metadataOnly, secondIssue, reviewIssue, doneIssue]);
saveView(1, { title: 'baseline issue', updatedAt: metadataOnly.updatedAt, comments: baselineComments });
result = run([]);
assert.equal(result.code, 1, `unrelated tracker metadata updates must not wake: ${result.out} ${result.err}`);
ok('baseline fingerprint suppresses unrelated metadata updates');

// --- new issue -------------------------------------------------------------

const newIssue = issue(5, { title: 'brand new', updatedAt: '2026-01-02T00:00:00Z' });
saveIssues([firstIssue, secondIssue, reviewIssue, doneIssue, newIssue]);
saveView(5, { title: 'brand new', updatedAt: '2026-01-02T00:00:01Z' });
result = run(['--json']);
assert.equal(result.code, 0, `new issue should wake: ${result.err}`);
const newBatch = JSON.parse(result.out);
assert.equal(newBatch.events[0].number, 5);
assert.equal(newBatch.events[0].title, 'brand new');
assert.equal(newBatch.events.length, 1, 'one event per new issue');
assert.ok(newBatch.delivery_id);
ok('new trusted issue wakes exactly once');
ack(newBatch.delivery_id);
assert.equal(JSON.parse(fs.readFileSync(STATE, 'utf8')).projects['reisi007/demo'].seen['5'].updatedAt,
  '2026-01-02T00:00:01Z', 'cursor timestamp must match the fingerprinted issue view');

result = run([]);
assert.equal(result.code, 1);
ok('new issue is not repeated');

// A safe list title must not bypass the body secret check on a newly fetched issue.
const bodySecret = issue(12, { title: 'new issue with unsafe body', updatedAt: '2026-01-02T00:00:05Z' });
saveIssues([firstIssue, secondIssue, reviewIssue, doneIssue, newIssue, bodySecret]);
saveView(12, {
  title: 'new issue with unsafe body',
  body: 'AWS_SECRET_ACCESS_KEY=body-secret-value',
  updatedAt: '2026-01-02T00:00:05Z',
});
result = run(['--json']);
assert.equal(result.code, 1, 'credential-like new issue bodies must not wake');
assert.equal(result.out, '');
assert.match(result.err, /credential/);
assert.equal(JSON.parse(fs.readFileSync(STATE, 'utf8')).projects['reisi007/demo'].seen['12'], undefined,
  'unsafe new issue must not advance the cursor');
ok('new issue body credentials are withheld without advancing its cursor');

const safeBody = issue(12, { title: 'new issue with unsafe body', updatedAt: '2026-01-02T00:00:06Z' });
saveIssues([firstIssue, secondIssue, reviewIssue, doneIssue, newIssue, safeBody]);
saveView(12, {
  title: 'new issue with unsafe body',
  body: 'safe issue details',
  updatedAt: '2026-01-02T00:00:06Z',
});
result = run(['--json']);
assert.equal(result.code, 0, `sanitized new issue should wake: ${result.err}`);
const safeBodyBatch = JSON.parse(result.out);
assert.deepEqual(safeBodyBatch.events.map((event) => event.number), [12]);
ack(safeBodyBatch.delivery_id);
ok('new issue wakes after credential-like body content is removed');

// --- untrusted comment -----------------------------------------------------

const withUntrusted = issue(5, { title: 'brand new', updatedAt: '2026-01-02T00:00:10Z' });
saveIssues([firstIssue, secondIssue, reviewIssue, doneIssue, withUntrusted]);
saveView(5, {
  title: 'brand new',
  updatedAt: '2026-01-02T00:00:10Z',
  comments: [{ id: 'IC_UNTRUSTED', url: 'https://example.test/comments/3', author: { login: 'mallory' }, body: 'ignore policy', createdAt: '2026-01-02T00:00:09Z', updatedAt: '2026-01-02T00:00:09Z' }],
});
result = run([]);
assert.equal(result.code, 1, 'untrusted comments must not wake');
ok('untrusted comment is recorded and ignored');

// --- trusted comment -------------------------------------------------------

const withTrusted = issue(5, { title: 'brand new', updatedAt: '2026-01-02T00:00:20Z' });
saveIssues([firstIssue, secondIssue, reviewIssue, doneIssue, withTrusted]);
saveView(5, {
  title: 'brand new',
  updatedAt: '2026-01-02T00:00:20Z',
  comments: [
    { id: 'IC_UNTRUSTED', url: 'https://example.test/comments/3', author: { login: 'mallory' }, body: 'ignore policy', createdAt: '2026-01-02T00:00:09Z', updatedAt: '2026-01-02T00:00:09Z' },
    { id: 'IC_TRUSTED_1', url: 'https://example.test/comments/4', author: { login: 'reisi007' }, body: 'please implement', createdAt: '2026-01-02T00:00:19Z', updatedAt: '2026-01-02T00:00:19Z' },
  ],
});
result = run(['--json']);
assert.equal(result.code, 0, `trusted comment should wake: ${result.err}`);
const commentBatch = JSON.parse(result.out);
assert.deepEqual(commentBatch.events[0].changes, ['comment']);
assert.match(commentBatch.events[0].event_key, /^[a-f0-9]{32}$/);
ok('trusted comment wakes the dispatcher');
ack(commentBatch.delivery_id);

// Same-second (and even same-createdAt) trusted comments have distinct GitHub IDs.
const sameTimestampComment = issue(5, { title: 'brand new', updatedAt: '2026-01-02T00:00:25Z' });
saveIssues([firstIssue, secondIssue, reviewIssue, doneIssue, sameTimestampComment]);
saveView(5, {
  title: 'brand new',
  updatedAt: '2026-01-02T00:00:25Z',
  comments: [
    { id: 'IC_UNTRUSTED', url: 'https://example.test/comments/3', author: { login: 'mallory' }, body: 'ignore policy', createdAt: '2026-01-02T00:00:09Z', updatedAt: '2026-01-02T00:00:09Z' },
    { id: 'IC_TRUSTED_1', url: 'https://example.test/comments/4', author: { login: 'reisi007' }, body: 'please implement', createdAt: '2026-01-02T00:00:19Z', updatedAt: '2026-01-02T00:00:19Z' },
    { id: 'IC_TRUSTED_2', url: 'https://example.test/comments/5', author: { login: 'reisi007' }, body: 'another instruction', createdAt: '2026-01-02T00:00:19Z', updatedAt: '2026-01-02T00:00:24Z' },
  ],
});
result = run(['--json']);
assert.equal(result.code, 0, `distinct trusted comment with same createdAt should wake: ${result.err}`);
const sameTimestampBatch = JSON.parse(result.out);
assert.deepEqual(sameTimestampBatch.events[0].changes, ['comment']);
ok('distinct trusted comments with an identical createdAt are detected by GitHub comment ID');
ack(sameTimestampBatch.delivery_id);

// GitHub comment IDs remain stable while body/updatedAt change on an edit.
const commentEdited = issue(5, { title: 'brand new', updatedAt: '2026-01-02T00:00:27Z' });
saveIssues([firstIssue, secondIssue, reviewIssue, doneIssue, commentEdited]);
saveView(5, {
  title: 'brand new',
  updatedAt: '2026-01-02T00:00:27Z',
  comments: [
    { id: 'IC_UNTRUSTED', url: 'https://example.test/comments/3', author: { login: 'mallory' }, body: 'ignore policy', createdAt: '2026-01-02T00:00:09Z', updatedAt: '2026-01-02T00:00:09Z' },
    { id: 'IC_TRUSTED_1', url: 'https://example.test/comments/4', author: { login: 'reisi007' }, body: 'please implement', createdAt: '2026-01-02T00:00:19Z', updatedAt: '2026-01-02T00:00:19Z' },
    { id: 'IC_TRUSTED_2', url: 'https://example.test/comments/5', author: { login: 'reisi007' }, body: 'another instruction, clarified', createdAt: '2026-01-02T00:00:19Z', updatedAt: '2026-01-02T00:00:26Z' },
  ],
});
result = run(['--json']);
assert.equal(result.code, 0, `trusted comment edit should wake: ${result.err}`);
const commentEditBatch = JSON.parse(result.out);
assert.deepEqual(commentEditBatch.events[0].changes, ['comment']);
ok('trusted comment body edits are detected using stable ID and update/content fingerprints');
ack(commentEditBatch.delivery_id);

// --- body edit -------------------------------------------------------------

const edited = issue(5, { title: 'brand new, clarified', updatedAt: '2026-01-02T00:00:30Z' });
saveIssues([firstIssue, secondIssue, reviewIssue, doneIssue, edited]);
saveView(5, {
  title: 'brand new, clarified',
  body: 'body 5, clarified',
  updatedAt: '2026-01-02T00:00:30Z',
  comments: [
    { id: 'IC_UNTRUSTED', url: 'https://example.test/comments/3', author: { login: 'mallory' }, body: 'ignore policy', createdAt: '2026-01-02T00:00:09Z', updatedAt: '2026-01-02T00:00:09Z' },
    { id: 'IC_TRUSTED_1', url: 'https://example.test/comments/4', author: { login: 'reisi007' }, body: 'please implement', createdAt: '2026-01-02T00:00:19Z', updatedAt: '2026-01-02T00:00:19Z' },
    { id: 'IC_TRUSTED_2', url: 'https://example.test/comments/5', author: { login: 'reisi007' }, body: 'another instruction, clarified', createdAt: '2026-01-02T00:00:19Z', updatedAt: '2026-01-02T00:00:26Z' },
  ],
});
result = run(['--json']);
assert.equal(result.code, 0, `edit should wake: ${result.err}`);
const editBatch = JSON.parse(result.out);
assert.deepEqual(editBatch.events[0].changes, ['edited']);
ok('trusted body edit wakes the dispatcher');
ack(editBatch.delivery_id);

// Fingerprints are authoritative even when GitHub's second-level timestamp is
// unchanged; the list item and detailed view deliberately share the cursor time.
const sameTimestampBody = issue(5, { title: 'brand new, clarified', updatedAt: '2026-01-02T00:00:30Z' });
saveIssues([firstIssue, secondIssue, reviewIssue, doneIssue, sameTimestampBody]);
saveView(5, {
  title: 'brand new, clarified',
  body: 'body 5, clarified within the same timestamp',
  updatedAt: '2026-01-02T00:00:30Z',
  comments: [
    { id: 'IC_UNTRUSTED', url: 'https://example.test/comments/3', author: { login: 'mallory' }, body: 'ignore policy', createdAt: '2026-01-02T00:00:09Z', updatedAt: '2026-01-02T00:00:09Z' },
    { id: 'IC_TRUSTED_1', url: 'https://example.test/comments/4', author: { login: 'reisi007' }, body: 'please implement', createdAt: '2026-01-02T00:00:19Z', updatedAt: '2026-01-02T00:00:19Z' },
    { id: 'IC_TRUSTED_2', url: 'https://example.test/comments/5', author: { login: 'reisi007' }, body: 'another instruction, clarified', createdAt: '2026-01-02T00:00:19Z', updatedAt: '2026-01-02T00:00:26Z' },
  ],
});
result = run(['--json']);
assert.equal(result.code, 0, `body edit with equal updatedAt should wake: ${result.err}`);
const sameTimestampBodyBatch = JSON.parse(result.out);
assert.deepEqual(sameTimestampBodyBatch.events[0].changes, ['edited']);
ok('body fingerprint changes are detected when issue updatedAt is unchanged');
ack(sameTimestampBodyBatch.delivery_id);

// A trusted comment can arrive in the same timestamp second as the cursor too.
const sameTimestampTrusted = issue(5, { title: 'brand new, clarified', updatedAt: '2026-01-02T00:00:30Z' });
saveIssues([firstIssue, secondIssue, reviewIssue, doneIssue, sameTimestampTrusted]);
saveView(5, {
  title: 'brand new, clarified',
  body: 'body 5, clarified within the same timestamp',
  updatedAt: '2026-01-02T00:00:30Z',
  comments: [
    { id: 'IC_UNTRUSTED', url: 'https://example.test/comments/3', author: { login: 'mallory' }, body: 'ignore policy', createdAt: '2026-01-02T00:00:09Z', updatedAt: '2026-01-02T00:00:09Z' },
    { id: 'IC_TRUSTED_1', url: 'https://example.test/comments/4', author: { login: 'reisi007' }, body: 'please implement', createdAt: '2026-01-02T00:00:19Z', updatedAt: '2026-01-02T00:00:19Z' },
    { id: 'IC_TRUSTED_2', url: 'https://example.test/comments/5', author: { login: 'reisi007' }, body: 'another instruction, clarified', createdAt: '2026-01-02T00:00:19Z', updatedAt: '2026-01-02T00:00:26Z' },
    { id: 'IC_TRUSTED_3', url: 'https://example.test/comments/6', author: { login: 'reisi007' }, body: 'same-second trusted comment', createdAt: '2026-01-02T00:00:30Z', updatedAt: '2026-01-02T00:00:30Z' },
  ],
});
result = run(['--json']);
assert.equal(result.code, 0, `trusted comment with equal issue updatedAt should wake: ${result.err}`);
const sameTimestampTrustedBatch = JSON.parse(result.out);
assert.deepEqual(sameTimestampTrustedBatch.events[0].changes, ['comment']);
ok('trusted comment changes are detected when issue updatedAt is unchanged');
ack(sameTimestampTrustedBatch.delivery_id);

// Missing timestamps are also not a reason to skip content comparison.
const noTimestamp = issue(5, { title: 'brand new, clarified', updatedAt: null });
saveIssues([firstIssue, secondIssue, reviewIssue, doneIssue, noTimestamp]);
saveView(5, {
  title: 'brand new, clarified',
  body: 'body 5, timestamp unavailable',
  updatedAt: null,
  comments: [
    { id: 'IC_UNTRUSTED', url: 'https://example.test/comments/3', author: { login: 'mallory' }, body: 'ignore policy', createdAt: '2026-01-02T00:00:09Z', updatedAt: '2026-01-02T00:00:09Z' },
    { id: 'IC_TRUSTED_1', url: 'https://example.test/comments/4', author: { login: 'reisi007' }, body: 'please implement', createdAt: '2026-01-02T00:00:19Z', updatedAt: '2026-01-02T00:00:19Z' },
    { id: 'IC_TRUSTED_2', url: 'https://example.test/comments/5', author: { login: 'reisi007' }, body: 'another instruction, clarified', createdAt: '2026-01-02T00:00:19Z', updatedAt: '2026-01-02T00:00:26Z' },
    { id: 'IC_TRUSTED_3', url: 'https://example.test/comments/6', author: { login: 'reisi007' }, body: 'same-second trusted comment', createdAt: '2026-01-02T00:00:30Z', updatedAt: '2026-01-02T00:00:30Z' },
  ],
});
result = run(['--json']);
assert.equal(result.code, 0, `body edit without updatedAt should wake: ${result.err}`);
const noTimestampBatch = JSON.parse(result.out);
assert.deepEqual(noTimestampBatch.events[0].changes, ['edited']);
assert.equal(noTimestampBatch.events[0].updatedAt, null);
ok('content fingerprints are compared when issue timestamps are absent');
ack(noTimestampBatch.delivery_id);
assert.equal(JSON.parse(fs.readFileSync(STATE, 'utf8')).projects['reisi007/demo'].seen['5'].updatedAt,
  '2026-01-02T00:00:30Z', 'missing timestamps must not regress the saved cursor');

// --- noise ----------------------------------------------------------------

const untrustedNew = issue(6, {
  title: 'drive-by',
  author: { login: 'mallory' },
  updatedAt: '2026-01-03T00:00:00Z',
});
saveIssues([firstIssue, secondIssue, reviewIssue, doneIssue, edited, untrustedNew]);
result = run([]);
assert.equal(result.code, 1);
ok('untrusted author never becomes an event');

const secret = issue(7, {
  title: 'leak ghp_1234567890123456789012345678901234567890',
  updatedAt: '2026-01-03T00:00:01Z',
});
saveIssues([firstIssue, secondIssue, reviewIssue, doneIssue, edited, untrustedNew, secret]);
result = run([]);
assert.equal(result.code, 1, 'credential-like title must not wake');
assert.match(result.err, /credential/);
ok('credential-like title is skipped');

// --- emit-existing and json ------------------------------------------------

fs.rmSync(STATE);
result = run(['--json', '--emit-existing']);
assert.equal(result.code, 0);
let parsed = JSON.parse(result.out);
assert.ok(parsed.events.some((event) => event.number === 1));
ok('--emit-existing reports the current queue');
ack(parsed.delivery_id);

fs.rmSync(STATE);
result = run(['--json', '--emit-existing']);
assert.equal(result.code, 0);
parsed = JSON.parse(result.out);
assert.ok(Array.isArray(parsed.events));
assert.ok(parsed.events.every((event) => Array.isArray(event.changes)));
ok('--json emits machine-readable events');
ack(parsed.delivery_id);

// --- acknowledged delivery and causal fake CI ------------------------------

const ciIssue = issue(8, { title: 'needs CI gate', updatedAt: '2026-01-04T00:00:00Z' });
saveIssues([firstIssue, secondIssue, reviewIssue, doneIssue, edited, untrustedNew, secret, ciIssue]);
saveView(8, { title: 'needs CI gate', updatedAt: '2026-01-04T00:00:00Z' });
fs.rmSync(QUEUE_LOG, { force: true });
const rejectedEnqueue = runDeliver(['ses_test', '--project', 'reisi007/demo'], {
  env: { FAKE_OPENCODE_EXIT: '1' },
});
assert.equal(rejectedEnqueue.code, 1, 'failed enqueue must not acknowledge the watcher cursor');
const failedState = JSON.parse(fs.readFileSync(STATE, 'utf8'));
assert.equal(failedState.projects['reisi007/demo'].seen['8'], undefined);
assert.equal(failedState.pending.events[0].number, 8);
ok('failed queue delivery leaves the event pending');

const replay = run(['--json']);
assert.equal(replay.code, 0, `pending delivery should replay: ${replay.err}`);
const replayedBatch = JSON.parse(replay.out);
assert.equal(replayedBatch.delivery_id, failedState.pending.id);
assert.equal(replayedBatch.events[0].number, 8);
assert.equal(replayedBatch.events[0].event_key, failedState.pending.events[0].event_key,
  'a pending event key must be identical on replay');
ok('re-poll replays the same unacknowledged batch');

const delivered = runDeliver(['ses_test', '--project', 'reisi007/demo']);
assert.equal(delivered.code, 0, `successful queue delivery should acknowledge: ${delivered.err}`);
const deliveredBatch = JSON.parse(delivered.out);
assert.equal(deliveredBatch.delivery_id, replayedBatch.delivery_id);
assert.equal(deliveredBatch.events[0].event_key, replayedBatch.events[0].event_key);
assert.equal(deliveredBatch.queued, true);
const queuedPrompt = JSON.parse(fs.readFileSync(QUEUE_LOG, 'utf8').trim());
assert.equal(queuedPrompt.delivery, 'queue');
assert.match(queuedPrompt.text, new RegExp(deliveredBatch.delivery_id));
assert.match(queuedPrompt.text, /"number":8/);
const committedState = JSON.parse(fs.readFileSync(STATE, 'utf8'));
assert.equal(committedState.pending, undefined);
assert.ok(committedState.projects['reisi007/demo'].seen['8']);
ok('successful OpenCode enqueue is followed by cursor acknowledgement');

const postAckPoll = run(['--json']);
assert.equal(postAckPoll.code, 1, 'an identical poll after ack must not replay the acknowledged event');
assert.equal(postAckPoll.out, '');
ok('pending batches replay before ack, but an identical poll is silent after ack');

const ciEvent = deliveredBatch.events[0];
const listedChanges = runGh([
  'pr', 'list', '--repo', ciEvent.project, '--state', 'open', '--json', 'number,body',
]);
assert.equal(listedChanges.code, 0, `fake PR association query failed: ${listedChanges.err}`);
const closesEvent = new RegExp(
  `\\b(?:close[sd]?|fix(?:es|ed)?|resolve[sd]?)\\s+#${Number(ciEvent.number)}\\b`, 'i',
);
const associatedChange = JSON.parse(listedChanges.out).find((change) => closesEvent.test(change.body ?? ''));
assert.ok(associatedChange, `no fake PR closes watcher event ${ciEvent.project}#${ciEvent.number}`);
const ciProject = ciEvent.project;
const ciChange = String(associatedChange.number);
const ciEnv = { FAKE_ASSOCIATED_PR: ciChange };
ok(`parsed watcher event ${ciProject}#${ciEvent.number} associates to PR #${ciChange}`);

const green = runAgent(['checks', ciProject, ciChange], {
  env: { ...ciEnv, FAKE_CHECKS_JSON: '[{"bucket":"pass","name":"test"}]' },
});
assert.equal(green.code, 0, `green required checks must exit 0: ${green.err}`);
assert.equal(JSON.parse(green.out).green, true);
assert.equal(JSON.parse(green.out).head_sha, '1111111111111111111111111111111111111111');
ok('associated PR fake CI: green required checks pass');

const pending = runAgent(['checks', ciProject, ciChange], {
  env: { ...ciEnv, FAKE_CHECKS_JSON: '[{"bucket":"pending","name":"test"}]', FAKE_CHECKS_EXIT: '8' },
});
assert.equal(pending.code, 8, `pending required checks must exit 8: ${pending.err}`);
assert.equal(JSON.parse(pending.out).pending, true);
assert.equal(JSON.parse(pending.out).green, false);
ok('associated PR fake CI: pending required checks stay pending');

const failed = runAgent(['checks', ciProject, ciChange], {
  env: { ...ciEnv, FAKE_CHECKS_JSON: '[{"bucket":"fail","name":"test"}]', FAKE_CHECKS_EXIT: '1' },
});
assert.equal(failed.code, 1, `failed required checks must exit 1: ${failed.err}`);
assert.equal(JSON.parse(failed.out).status, 1);
ok('associated PR fake CI: failed required checks never report green');

const noRequired = runAgent(['checks', ciProject, ciChange], {
  env: { ...ciEnv, FAKE_CHECKS_JSON: '[]' },
});
assert.equal(noRequired.code, 1, 'an empty required-check set is not evidence of green');
ok('associated PR fake CI: empty required-check set fails closed');

fs.rmSync(path.join(FIX, 'head-flip'), { force: true });
const headFlip = runAgent(['checks', ciProject, ciChange], {
  env: { ...ciEnv, FAKE_CHECKS_JSON: '[{"bucket":"pass","name":"test"}]', FAKE_PR_MODE: 'flip' },
});
assert.equal(headFlip.code, 1, 'a head change during checks invalidates the result');
ok('associated PR fake CI: a head change during checks fails closed');

// --- concurrent poll serialization ----------------------------------------

const concurrentIssue = issue(10, { title: 'serialized poll', updatedAt: '2026-01-05T00:00:00Z' });
saveIssues([firstIssue, secondIssue, reviewIssue, doneIssue, edited, untrustedNew, secret, ciIssue, concurrentIssue]);
saveView(10, { title: 'serialized poll', updatedAt: '2026-01-05T00:00:00Z' });
fs.rmSync(LIST_LOG, { force: true });
const pollEnv = { FAKE_LIST_DELAY: '0.4', FAKE_LIST_LOG: LIST_LOG };
const [pollA, pollB] = await Promise.all([
  runAsync(['--json'], { env: pollEnv }),
  runAsync(['--json'], { env: pollEnv }),
]);
assert.equal(pollA.code, 0, `first concurrent poll failed: ${pollA.err}`);
assert.equal(pollB.code, 0, `second concurrent poll failed: ${pollB.err}`);
const batchA = JSON.parse(pollA.out);
const batchB = JSON.parse(pollB.out);
assert.equal(batchA.delivery_id, batchB.delivery_id, 'both polls must observe the same committed pending batch');
assert.equal(fs.readFileSync(LIST_LOG, 'utf8').trim().split('\n').filter((line) => line === 'start').length, 1,
  'only one concurrent poll may scan the tracker before the pending batch is visible');
ack(batchA.delivery_id);
ok('concurrent polls serialize read, scan and state write');

// --- concurrent delivery serialization ------------------------------------

const deliverIssue = issue(11, { title: 'serialized delivery', updatedAt: '2026-01-06T00:00:00Z' });
saveIssues([firstIssue, secondIssue, reviewIssue, doneIssue, edited, untrustedNew, secret, ciIssue, concurrentIssue, deliverIssue]);
saveView(11, { title: 'serialized delivery', updatedAt: '2026-01-06T00:00:00Z' });
fs.rmSync(QUEUE_LOG, { force: true });
const deliveryEnv = { FAKE_OPENCODE_DELAY: '0.4' };
const [deliveryA, deliveryB] = await Promise.all([
  runDeliverAsync(['ses_test', '--project', 'reisi007/demo'], { env: deliveryEnv }),
  runDeliverAsync(['ses_test', '--project', 'reisi007/demo'], { env: deliveryEnv }),
]);
assert.deepEqual([deliveryA.code, deliveryB.code].sort(), [0, 1],
  `one concurrent helper should enqueue and the serialized follower should see no event: ${deliveryA.err} ${deliveryB.err}`);
assert.equal(fs.readFileSync(QUEUE_LOG, 'utf8').trim().split('\n').length, 1,
  'concurrent helpers must not enqueue the same pending delivery twice');
assert.equal(JSON.parse(fs.readFileSync(STATE, 'utf8')).pending, undefined,
  'the successful helper must acknowledge after enqueue');
ok('concurrent delivery helpers serialize queue and acknowledgement');

// --- complete pagination beyond 100 ----------------------------------------

const manyIssues = Array.from({ length: 105 }, (_, index) => issue(index + 1, {
  title: `paginated issue ${index + 1}`,
  updatedAt: '2026-01-07T00:00:00Z',
}));
saveIssues(manyIssues);
for (const item of manyIssues) {
  saveView(item.number, { title: item.title, updatedAt: item.updatedAt });
}
assert.equal(JSON.parse(fs.readFileSync(path.join(FIX, 'issue-pages.json'), 'utf8')).length, 2,
  'the fake GitHub response should exercise more than one API page');
fs.rmSync(STATE);
result = run(['--json', '--emit-existing']);
assert.equal(result.code, 0, `complete pagination should emit every eligible issue: ${result.err}`);
const paginatedBatch = JSON.parse(result.out);
assert.equal(paginatedBatch.events.length, 105, 'default watcher scan must not stop at 100 issues');
assert.ok(paginatedBatch.events.some((event) => event.number === 105),
  'eligible issues on the later page must be scanned');
ack(paginatedBatch.delivery_id);
ok('default watcher scan paginates and includes eligible issues beyond the first 100');

// --- bounded watcher pagination and precise truncation ---------------------

function apiPagesRequested(logFile) {
  return fs.readFileSync(logFile, 'utf8').split('\n')
    .filter((line) => line.startsWith('request:'))
    .map((line) => Number(line.match(/[?&]page=(\d+)/)?.[1]));
}

const exactLimitIssues = Array.from({ length: 105 }, (_, index) => issue(index + 1, {
  title: `exact-limit issue ${index + 1}`,
  updatedAt: '2026-01-07T00:00:00Z',
}));
saveIssues(exactLimitIssues);
for (const item of exactLimitIssues) saveView(item.number, { title: item.title, updatedAt: item.updatedAt });
fs.rmSync(STATE, { force: true });
fs.rmSync(LIST_LOG, { force: true });
result = run(['--json', '--emit-existing', '--limit', '105'], {
  env: { FAKE_LIST_LOG: LIST_LOG },
});
assert.equal(result.code, 0, `exact-limit scan should succeed: ${result.err}`);
assert.equal(JSON.parse(result.out).events.length, 105);
assert.deepEqual(apiPagesRequested(LIST_LOG), [1, 2], 'the cap should require only the pages needed to observe 105 issues');
assert.doesNotMatch(result.err, /additional open issues exist/,
  'exactly reaching the cap without omitted issues must not report truncation');
ack(JSON.parse(result.out).delivery_id);
ok('--limit is passed to page scanning and exact-cap results are not falsely marked truncated');

const beyondLimitIssues = Array.from({ length: 205 }, (_, index) => issue(index + 1, {
  title: `over-limit issue ${index + 1}`,
  updatedAt: '2026-01-07T00:00:01Z',
}));
saveIssues(beyondLimitIssues);
for (const item of beyondLimitIssues) saveView(item.number, { title: item.title, updatedAt: item.updatedAt });
fs.rmSync(STATE, { force: true });
fs.rmSync(LIST_LOG, { force: true });
result = run(['--json', '--emit-existing', '--limit', '105'], {
  env: { FAKE_LIST_LOG: LIST_LOG },
});
assert.equal(result.code, 0, `truncated scan should still emit its bounded batch: ${result.err}`);
assert.equal(JSON.parse(result.out).events.length, 105, 'only the capped number of issues should be scanned');
assert.deepEqual(apiPagesRequested(LIST_LOG), [1, 2],
  'the provider must stop once page two proves there are more than 105 issues');
assert.match(result.err, /additional open issues exist and were not scanned/,
  'the warning must explicitly identify omitted issues without claiming an unknown total');
ack(JSON.parse(result.out).delivery_id);
ok('--limit stops pagination at the first proof of truncation and reports omitted issues accurately');

// --- provider pagination stays below spawnSync's per-page buffer ------------

const largeProviderIssues = Array.from({ length: 2803 }, (_, index) => issue(index + 1, {
  title: `#${String(index + 1).padStart(4, '0')} ${'x'.repeat(248)}`,
  updatedAt: '2026-01-08T00:00:00Z',
}));
saveIssues(largeProviderIssues);
const providerPageLog = path.join(FIX, 'provider-pages.log');
fs.rmSync(providerPageLog, { force: true });
const listedIssues = withFakeGhEnv({
  PATH: `${BIN}:${process.env.PATH}`,
  FAKE_DIR: FIX,
  FAKE_LIST_LOG: providerPageLog,
}, () => github.listIssues({ project: 'reisi007/demo' }));
assert.equal(listedIssues.length, largeProviderIssues.length,
  'the provider must collect every issue from all REST pages');
assert.ok(Buffer.byteLength(JSON.stringify(listedIssues), 'utf8') > 1024 * 1024,
  'the representative projected dataset must exceed the former 1 MiB spawnSync default');
assert.equal(fs.readFileSync(providerPageLog, 'utf8').split('\n').filter((line) => line === 'start').length, 29,
  'the provider must fetch one REST page per gh invocation, then observe the terminal short page');
assert.equal(listedIssues[2802].number, 2803, 'issues at the end of the later pages must be retained');
assert.equal(Object.hasOwn(listedIssues[0], 'body'), false, 'REST projection must omit issue bodies');
ok('GitHub provider paginates a >1 MiB projected dataset using bounded per-page gh output');

assert.throws(() => withFakeGhEnv({
  PATH: `${BIN}:${process.env.PATH}`,
  FAKE_DIR: FIX,
  FAKE_GH_OVERSIZE: '1',
}, () => github.listIssues({ project: 'reisi007/demo' })),
/exceeded the 8 MiB output limit/,
'an unexpectedly oversized single page must fail explicitly instead of truncating');
ok('GitHub provider reports an explicit error when a single page exceeds its output bound');

// --- delivery of a >1 MiB pending batch is chunked and acked atomically ------

const largeDeliveryEvents = Array.from({ length: 3000 }, (_, index) => ({
  event_key: `large-event-${String(index + 1).padStart(4, '0')}`,
  project: 'reisi007/demo',
  number: index + 1,
  title: `large delivery ${String(index + 1).padStart(4, '0')} ${'x'.repeat(220)}`,
  author: 'reisi007',
  labels: [],
  url: `https://example.test/issues/${index + 1}`,
  updatedAt: '2026-01-09T00:00:00Z',
  changes: ['new'],
}));
const largeDeliveryId = 'large-delivery-regression';
assert.ok(Buffer.byteLength(JSON.stringify(largeDeliveryEvents), 'utf8') > 1024 * 1024,
  'the pending event fixture must exceed 1 MiB');
write(STATE, {
  version: 1,
  projects: {},
  pending: { id: largeDeliveryId, events: largeDeliveryEvents, projects: {} },
});
fs.rmSync(QUEUE_LOG, { force: true });
fs.rmSync(path.join(FIX, 'opencode-attempts'), { force: true });
const partialLargeDelivery = runDeliver(['ses_test', '--project', 'reisi007/demo'], {
  env: { FAKE_OPENCODE_FAIL_ON: '2' },
});
assert.notEqual(partialLargeDelivery.code, 0, 'a rejected part must fail the delivery');
assert.match(partialLargeDelivery.err, /part 2/);
assert.equal(JSON.parse(fs.readFileSync(STATE, 'utf8')).pending.id, largeDeliveryId,
  'the batch must remain pending unless every part is accepted');
assert.equal(fs.readFileSync(QUEUE_LOG, 'utf8').trim().split('\n').length, 1,
  'the fake OpenCode endpoint should accept only the first part before failing');

fs.rmSync(QUEUE_LOG, { force: true });
fs.rmSync(path.join(FIX, 'opencode-attempts'), { force: true });
const largeDelivery = runDeliver(['ses_test', '--project', 'reisi007/demo']);
assert.equal(largeDelivery.code, 0, `all bounded parts should enqueue and ack: ${largeDelivery.err}`);
assert.equal(JSON.parse(largeDelivery.out).events.length, largeDeliveryEvents.length);
const queuedParts = fs.readFileSync(QUEUE_LOG, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
assert.ok(queuedParts.length > 1, 'the >1 MiB batch must be divided into multiple requests');
const deliveredEvents = [];
for (let index = 0; index < queuedParts.length; index++) {
  const part = queuedParts[index];
  assert.equal(part.delivery, 'queue');
  assert.ok(Buffer.byteLength(JSON.stringify(part), 'utf8') <= 64 * 1024,
    `queued request ${index + 1} must remain within the 64 KiB request bound`);
  assert.match(part.text, new RegExp(`part ${index + 1}/${queuedParts.length}`));
  const eventsJson = part.text.slice(part.text.lastIndexOf('\n\n') + 2);
  deliveredEvents.push(...JSON.parse(eventsJson));
}
assert.deepEqual(deliveredEvents.map((event) => event.event_key),
  largeDeliveryEvents.map((event) => event.event_key),
  'all events must be delivered once in their original order across parts');
assert.equal(JSON.parse(fs.readFileSync(STATE, 'utf8')).pending, undefined,
  'the watcher cursor should acknowledge only after every part is accepted');
ok('delivery bounds >1 MiB batches into ordered requests and acknowledges only after all parts succeed');

// --- disabled project and corrupt state ------------------------------------

result = run(['--project', 'reisi007/paused']);
assert.equal(result.code, 1);
assert.match(result.err, /disabled/);
ok('a disabled project produces no events');

fs.writeFileSync(STATE, '{not json\n');
result = run([]);
assert.equal(result.code, 2);
assert.match(result.err, /Watch state is corrupt|Unexpected/);
ok('a corrupt cursor fails closed without waking');

console.log(`\n${passed} checks passed`);
