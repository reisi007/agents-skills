#!/usr/bin/env node
// Deterministic watcher for the headless queue.
//
// The model should only run when something actually changed. This script owns
// the cheap part: list trusted open issues, drop lifecycle labels, compare
// issue/comment fingerprints with a small cursor, and stage a pending batch for
// each real event. The batch is replayed until a caller acknowledges successful
// enqueue. It never writes to the tracker.
//
// Use deliver.mjs from cron/launchd to queue and acknowledge a batch. See
// references/dispatcher.md.
import { createHash, randomUUID } from 'node:crypto';
import {
  loadConfig,
  enabledRepos,
  repoConfig,
  readWatchState,
  writeWatchState,
  withWatchStateLock,
} from './config.mjs';
import { getProvider } from './providers/index.mjs';
import { containsSecretLikeContent } from './evidence.mjs';

const HELP = `Usage: node "$SKILL_DIR/scripts/watch.mjs" [options]

  --project <p>      only this project (default: every enabled project)
  --config <path>    isolate config/state (default: the runtime home)
  --limit <n>        explicit per-project cap (default: all open issues)
  --emit-existing    first run: report open issues instead of baselining
  --all-authors      include untrusted authors (they stay data, never instructions)
  --json             machine-readable output
  --ack <delivery>   commit the matching pending batch after successful enqueue
  --quiet            no diagnostics on stderr
  help

Output: one compact event per line (or {"delivery_id":"…","events":[...]} with --json).
Each event has a stable event_key; the delivery_id is stable while a batch is pending.
Exit codes: 0 = pending batch output or ack success, 1 = nothing new, 2 = error.
Events remain pending until acknowledged; repeated polls replay the same batch.
`;

const LIFECYCLE = ['working', 'done', 'blocked', 'review', 'needs_info'];

class WatchError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.exitCode = exitCode;
  }
}

function parseArgs(argv) {
  const opts = { _: [], quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      opts._.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      opts[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      opts[key] = next;
      i++;
    } else {
      opts[key] = true;
    }
  }
  return opts;
}

function warn(opts, message) {
  if (!opts.quiet) process.stderr.write(`watch: ${message}\n`);
}

function labelNames(item) {
  return (item.labels ?? []).map((label) => (
    typeof label === 'string' ? label : label.name
  )).filter(Boolean);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function trustedCommentFingerprint(view, trustedAuthors) {
  const trusted = new Set(trustedAuthors);
  const fallbackCounts = new Map();
  const comments = (view.comments ?? [])
    .filter((comment) => trusted.has(comment.author?.login))
    .map((comment) => {
      const body = comment.body ?? '';
      const author = comment.author?.login ?? '';
      // gh exposes GitHub's stable GraphQL node ID as `id`. `databaseId` and
      // the comment URL are supported for older/newer gh JSON projections.
      // The fallback is only for synthetic/third-party providers without IDs.
      const stableId = comment.id ?? comment.databaseId ?? comment.url ?? comment.htmlUrl;
      let id;
      if (stableId !== undefined && stableId !== null && String(stableId)) {
        id = String(stableId);
      } else {
        const base = sha256(JSON.stringify([author, comment.createdAt ?? null, body]));
        const occurrence = fallbackCounts.get(base) ?? 0;
        fallbackCounts.set(base, occurrence + 1);
        id = `fallback:${base}:${occurrence}`;
      }
      return {
        id,
        contentHash: sha256(body),
        updatedAt: comment.updatedAt ?? null,
        createdAt: comment.createdAt ?? null,
      };
    })
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  const commentTimes = comments.map((comment) => comment.createdAt).filter(Boolean).sort();
  return {
    trustedComments: comments,
    lastCommentAt: commentTimes.at(-1) ?? null,
  };
}

function contentFingerprint(view, trustedAuthors) {
  const contentHash = sha256(`${view.title ?? ''}\u0000${view.body ?? ''}`).slice(0, 16);
  return {
    contentHash,
    ...trustedCommentFingerprint(view, trustedAuthors),
  };
}

function observedUpdatedAt(item, view, previousAt = null) {
  const candidates = [previousAt, item.updatedAt, view.updatedAt]
    .filter((value) => typeof value === 'string' && value);
  let latest = null;
  for (const candidate of candidates) {
    const candidateTime = Date.parse(candidate);
    const latestTime = latest ? Date.parse(latest) : Number.NaN;
    if (!latest || (Number.isFinite(candidateTime) &&
        (!Number.isFinite(latestTime) || candidateTime > latestTime))) {
      latest = candidate;
    }
  }
  return latest;
}

function readIssue(provider, project, number, opts) {
  try {
    return provider.viewIssue({ project, number: Number(number) });
  } catch (error) {
    warn(opts, `could not read ${project}#${number}: ${error.message}`);
    return null;
  }
}

function emitBatch(batch, opts) {
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(batch, null, 2)}\n`);
    return;
  }
  process.stdout.write(`GitHub events (${batch.events.length}; delivery ${batch.delivery_id}):\n`);
  for (const event of batch.events) process.stdout.write(`${formatEvent(event)}\n`);
}

function formatEvent(event) {
  const labels = event.labels.length > 0 ? event.labels.join(', ') : 'none';
  const changes = event.changes.join('+');
  return `- ${event.project}#${event.number} [${changes}] "${event.title}" — ` +
    `@${event.author} — ${event.updatedAt ?? 'unknown time'} — labels: ${labels} — ${event.url ?? ''} — event ${event.event_key}`;
}

function makeEvent(project, item, changes, updatedAt = item.updatedAt ?? null, fingerprint = {}) {
  const eventKey = sha256(JSON.stringify({
    project,
    number: Number(item.number),
    updatedAt,
    changes,
    contentHash: fingerprint.contentHash ?? null,
    trustedComments: fingerprint.trustedComments ?? [],
  })).slice(0, 32);
  return {
    event_key: eventKey,
    project,
    number: item.number,
    title: item.title,
    author: item.author?.login ?? item.author ?? null,
    labels: labelNames(item),
    url: item.url ?? null,
    updatedAt,
    changes,
  };
}

function verifyAccounts(projects, cfg, opts) {
  const verified = new Set();
  for (const project of projects) {
    const rc = repoConfig(cfg, project);
    if (!rc.enabled || verified.has(`${rc.provider}:${rc.account}`)) continue;
    const provider = getProvider(rc.provider);
    if (typeof provider.verifyAccount === 'function') {
      try {
        provider.verifyAccount(rc.account);
      } catch (error) {
        throw new WatchError(`${project}: ${error.message}`);
      }
    }
    verified.add(`${rc.provider}:${rc.account}`);
  }
}

function scanProject(project, cfg, previous, opts, events) {
  const rc = repoConfig(cfg, project);
  if (!rc.enabled) {
    warn(opts, `${project} is disabled; skipped`);
    return null;
  }
  const provider = getProvider(rc.provider);
  const listed = provider.listIssues({
    project,
    limit: opts.limit,
    includeTruncation: true,
  });
  const raw = listed.issues;
  if (listed.truncated) {
    warn(opts, `${project}: explicit --limit ${opts.limit} reached; additional open issues exist and were not scanned. Omit --limit for a complete scan`);
  }
  const blocked = new Set(LIFECYCLE.map((role) => rc.labels[role]).filter(Boolean));
  const trusted = new Set(rc.trusted_authors);
  const prior = previous.projects?.[project]?.seen ?? {};
  const nextSeen = { ...prior };
  const baseline = !previous.projects?.[project] && !opts['emit-existing'];
  let baselineCount = 0;

  for (const item of raw) {
    const labels = labelNames(item);
    if (labels.some((label) => blocked.has(label))) continue;
    const author = item.author?.login ?? item.author ?? null;
    if (!opts['all-authors'] && !trusted.has(author)) continue;
    if (containsSecretLikeContent(item.title ?? '')) {
      warn(opts, `${project}#${item.number} title looks like a credential; skipped`);
      continue;
    }

    const updatedAt = item.updatedAt ?? null;
    const entry = prior[item.number];
    if (!entry) {
      if (baseline) {
        const view = readIssue(provider, project, item.number, opts);
        if (!view) continue;
        nextSeen[item.number] = {
          updatedAt: observedUpdatedAt(item, view),
          ...contentFingerprint(view, rc.trusted_authors),
        };
        baselineCount += 1;
        continue;
      }
      const view = readIssue(provider, project, item.number, opts);
      if (!view) continue;
      if (containsSecretLikeContent(`${view.title ?? ''}\n${view.body ?? ''}`)) {
        warn(opts, `${project}#${item.number} contains credential-like content; skipped`);
        continue;
      }
      const observedAt = observedUpdatedAt(item, view);
      const fingerprint = contentFingerprint(view, rc.trusted_authors);
      nextSeen[item.number] = { updatedAt: observedAt, ...fingerprint };
      events.push(makeEvent(project, item, ['new'], observedAt, fingerprint));
      continue;
    }

    // GitHub issue timestamps have second-level precision and may be absent.
    // They are useful cursor metadata, but cannot gate content checks: two
    // changes can share a timestamp, and comment edits may not advance it.
    const view = readIssue(provider, project, item.number, opts);
    if (!view) continue;
    const observedAt = observedUpdatedAt(item, view);
    const cursorAt = observedUpdatedAt(item, view, entry.updatedAt);
    if (containsSecretLikeContent(`${view.title ?? ''}\n${view.body ?? ''}`)) {
      warn(opts, `${project}#${item.number} contains credential-like content; skipped`);
      nextSeen[item.number] = { ...entry, updatedAt: cursorAt };
      continue;
    }

    const fingerprint = contentFingerprint(view, rc.trusted_authors);
    const changes = [];
    if (entry.contentHash === null || entry.contentHash === undefined) {
      // Older cursor versions did not fingerprint their baseline. Establish a
      // snapshot without waking: we cannot distinguish historical edits from
      // unrelated tracker metadata updates in that one migration poll.
    } else {
      if (fingerprint.contentHash !== entry.contentHash) changes.push('edited');
      // Comment timestamps are not unique and do not change when a comment is
      // edited. Compare GitHub comment IDs plus body hashes/update times.
      if (entry.trustedComments &&
          JSON.stringify(fingerprint.trustedComments) !== JSON.stringify(entry.trustedComments)) {
        changes.push('comment');
      }
    }
    nextSeen[item.number] = {
      updatedAt: cursorAt,
      contentHash: fingerprint.contentHash,
      trustedComments: fingerprint.trustedComments,
      lastCommentAt: fingerprint.lastCommentAt ?? entry.lastCommentAt ?? null,
    };
    if (changes.length > 0) events.push(makeEvent(project, item, changes, observedAt, fingerprint));
  }

  if (baseline) {
    warn(opts, `${project}: baseline recorded (${baselineCount} open issues); no wake`);
  }
  return { seen: nextSeen, lastCheck: new Date().toISOString() };
}

function mainLocked(opts) {
  let cfg;
  let previous;
  try {
    cfg = loadConfig(opts.config);
    previous = readWatchState(opts.config);
  } catch (error) {
    throw new WatchError(error.message);
  }

  if (opts.ack !== undefined) {
    if (typeof opts.ack !== 'string' || !opts.ack) {
      throw new WatchError('--ack requires a delivery ID');
    }
    if (!previous.pending || previous.pending.id !== opts.ack) {
      throw new WatchError(`no pending watcher batch matches delivery ${opts.ack}`);
    }
    const acknowledged = {
      version: 1,
      projects: previous.pending.projects,
    };
    try {
      writeWatchState(acknowledged, opts.config);
    } catch (error) {
      throw new WatchError(`cannot acknowledge watcher batch: ${error.message}`);
    }
    if (!opts.quiet) process.stderr.write(`watch: acknowledged delivery ${opts.ack}\n`);
    return 0;
  }

  if (previous.pending) {
    emitBatch({ delivery_id: previous.pending.id, events: previous.pending.events }, opts);
    return 0;
  }

  const projects = opts.project ? [String(opts.project)] : enabledRepos(cfg);
  verifyAccounts(projects, cfg, opts);

  const state = {
    version: 1,
    projects: { ...(previous.projects ?? {}) },
  };
  const events = [];

  for (const project of projects) {
    const result = scanProject(project, cfg, previous, opts, events);
    if (result) state.projects[project] = result;
  }

  if (events.length > 0) {
    const pending = {
      id: randomUUID(),
      events,
      projects: state.projects,
    };
    try {
      writeWatchState({
        version: 1,
        projects: previous.projects ?? {},
        pending,
      }, opts.config);
    } catch (error) {
      throw new WatchError(`cannot persist pending watcher batch: ${error.message}`);
    }
    emitBatch({ delivery_id: pending.id, events: pending.events }, opts);
    return 0;
  }

  if (JSON.stringify(state) !== JSON.stringify(previous)) {
    try {
      writeWatchState(state, opts.config);
    } catch (error) {
      throw new WatchError(`cannot persist watch state: ${error.message}`);
    }
  }

  warn(opts, 'no new events');
  return 1;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || opts._[0] === 'help') {
    process.stdout.write(HELP);
    return 0;
  }
  if (opts.limit !== undefined) {
    if (typeof opts.limit !== 'string' || !/^[1-9]\d*$/.test(opts.limit) ||
        !Number.isSafeInteger(Number(opts.limit))) {
      throw new WatchError('--limit must be a positive safe integer');
    }
    opts.limit = Number(opts.limit);
  }
  return withWatchStateLock(opts.config, () => mainLocked(opts));
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(`watch: ${error.message}\n`);
  process.exitCode = error.exitCode ?? 2;
}
