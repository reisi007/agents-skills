#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  configPath,
  loadConfig,
  repoConfig,
  enabledRepos,
  readState,
  writeState,
  readLock,
  acquireLock,
  clearLock,
  lockPath,
  parseJsonc,
} from './config.mjs';
import { getProvider } from './providers/index.mjs';
import { publishEvidence } from './evidence.mjs';

const REVIEW_MARKER = '<!-- git-issue-agent:review-approved -->';
const EVIDENCE_MARKER = '<!-- git-issue-agent:evidence -->';

const SEVERITY = {
  'severity:critical': 0,
  'severity:high': 1,
  'severity:medium': 2,
  'severity:low': 3,
  'severity:info': 4,
};

const HELP = `Usage: node "$SKILL_DIR/scripts/agent.mjs" <command> [args] [--config <path>]

  status                          config, model, projects, lock (no writes)
  list [--project <p>] [--all-authors] [--limit <n>]
                                  open issues in queue order
  view <project> <issue>          issue body + comments, trusted flagged
  account <user> [--provider <p>] switch the provider CLI account
  claim <project> <issue> [--branch <b>] [--force]
                                  take/extend the one global lock + working label
  release [--result done|blocked|review|needs-info|none] [--force]
                                  drop the lock + outcome label
  label <project> <issue> add|remove <label>
  comment <project> <number> --body-file <f> [--kind issue|change]
  change-create <project> --head <b> --base <b> --title <t> --body-file <f> [--draft]
  checks <project> <number> [--watch] [--interval <s>]
  merge <project> <number>        markers + required checks, then merge
  evidence <project> <issue> --dir <dir> [--allow-secret-like]
  ensure-labels [--project <p>]
  capture-model [--write]         read the global OpenCode model
  set-model <provider/model>      write model into the config
  help

Global: --config <path> keeps state/lock beside that config; --no-switch skips
the provider account switch.

Exit codes: 0 done/green, 1 refused/failed, 2 config missing/invalid, 8 checks pending.`;

class CliError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

function parseArgs(argv) {
  const opts = { _: [] };
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

function requireConfig(opts) {
  try {
    return loadConfig(opts.config);
  } catch (error) {
    throw new CliError(error.message, 2);
  }
}

function configFile(opts) {
  return opts.config ?? configPath();
}

function assertEnabled(rc, project) {
  if (!rc.enabled) throw new CliError(`Project ${project} is disabled; refused`);
}

function context(cfg, project) {
  let rc;
  try {
    rc = repoConfig(cfg, project);
  } catch (error) {
    throw new CliError(error.message);
  }
  return { rc, provider: getProvider(rc.provider) };
}

function switchAccount(provider, rc, opts) {
  if (!rc.account || opts['no-switch']) return;
  provider.switchAccount(rc.account);
}

function bodyFromFile(file) {
  if (!file || file === true) throw new CliError('--body-file is required');
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new CliError(`Body file not found: ${abs}`);
  return fs.readFileSync(abs, 'utf8');
}

function severityRank(labels) {
  let rank = 5;
  for (const label of labels) {
    if (label in SEVERITY) rank = Math.min(rank, SEVERITY[label]);
  }
  return rank;
}

function requirePositional(values, usage) {
  if (values.length === 0 || values.some((value) => !value || value === true)) {
    throw new CliError(`usage: ${usage}`);
  }
  return values;
}

function cmdStatus(opts) {
  const cfg = requireConfig(opts);
  const state = readState(configFile(opts));
  const projects = Object.keys(cfg.repos).map((project) => {
    const rc = repoConfig(cfg, project);
    return {
      project,
      provider: rc.provider,
      account: rc.account,
      enabled: rc.enabled,
      local_only: rc.local_only,
      auto_merge: rc.auto_merge,
      base_branch: rc.base_branch,
    };
  });
  console.log(JSON.stringify({
    config: cfg.__file,
    provider: cfg.provider ?? 'github',
    model: cfg.model ?? null,
    accounts: cfg.accounts ?? [],
    trusted_authors: cfg.trusted_authors ?? [],
    projects,
    lock: readLock(lockPath(configFile(opts))),
    last_run: state.last_run ?? null,
  }, null, 2));
  return 0;
}

function cmdList(opts) {
  const cfg = requireConfig(opts);
  const onlyTrusted = !opts['all-authors'];
  const projects = opts.project ? [String(opts.project)] : enabledRepos(cfg);
  const issues = [];

  for (const project of projects) {
    const { rc, provider } = context(cfg, project);
    if (!rc.enabled) continue;
    switchAccount(provider, rc, opts);
    const raw = provider.listIssues({ project, limit: Number(opts.limit ?? 100) });
    const blocked = new Set(
      [rc.labels.working, rc.labels.done, rc.labels.blocked, rc.labels.review, rc.labels.needs_info]
        .filter(Boolean),
    );
    for (const item of raw) {
      const labels = (item.labels ?? []).map((label) => (
        typeof label === 'string' ? label : label.name
      ));
      if (labels.some((label) => blocked.has(label))) continue;
      const author = item.author?.login ?? item.author ?? null;
      const trusted = rc.trusted_authors.includes(author);
      if (onlyTrusted && !trusted) continue;
      issues.push({
        project,
        provider: rc.provider,
        number: item.number,
        title: item.title,
        author,
        trusted,
        labels,
        createdAt: item.createdAt ?? null,
        updatedAt: item.updatedAt ?? null,
        url: item.url ?? null,
      });
    }
  }

  issues.sort((a, b) => (
    severityRank(a.labels) - severityRank(b.labels) ||
    (Date.parse(a.createdAt ?? 0) - Date.parse(b.createdAt ?? 0))
  ));
  console.log(JSON.stringify(issues, null, 2));
  return 0;
}

function cmdView(opts) {
  const cfg = requireConfig(opts);
  const [project, number] = requirePositional(opts._.slice(0, 2), 'view <project> <issue>');
  const { rc, provider } = context(cfg, project);
  assertEnabled(rc, project);
  switchAccount(provider, rc, opts);
  const issue = provider.viewIssue({ project, number: Number(number) });
  const trusted = new Set(rc.trusted_authors);
  const comments = (issue.comments ?? []).map((comment) => ({
    ...comment,
    trusted: trusted.has(comment.author?.login),
  }));
  console.log(JSON.stringify({
    ...issue,
    comments,
    trusted_comments: comments.filter((comment) => comment.trusted),
  }, null, 2));
  return 0;
}

function cmdAccount(opts) {
  const cfg = requireConfig(opts);
  const [user] = requirePositional(opts._, 'account <user> [--provider <p>]');
  const provider = getProvider(opts.provider ?? cfg.provider ?? 'github');
  provider.switchAccount(user);
  console.log(JSON.stringify({ provider: provider.name, account: user }, null, 2));
  return 0;
}

function cmdClaim(opts) {
  const cfg = requireConfig(opts);
  const [project, issue] = requirePositional(
    opts._.slice(0, 2),
    'claim <project> <issue> [--branch <b>] [--force]',
  );
  const { rc, provider } = context(cfg, project);
  assertEnabled(rc, project);
  const number = Number(issue);
  if (!Number.isInteger(number) || number <= 0) throw new CliError(`Invalid issue number: ${issue}`);

  const lockFile = lockPath(configFile(opts));
  let previous = null;
  try {
    previous = readLock(lockFile);
  } catch (error) {
    if (!opts.force) throw new CliError(`Lock is corrupt: ${error.message}; release --force to clear`);
    fs.unlinkSync(lockFile);
  }

  // Stage 2 claims the queue before triage; Stage 3 re-runs claim with the
  // branch name. The same issue may extend its own lock, nobody else can.
  const sameClaim = previous && previous.repo === project && Number(previous.issue) === number;
  if (sameClaim && !opts.force) {
    const updated = {
      ...previous,
      branch: opts.branch ?? previous.branch ?? null,
      local_only: rc.local_only,
    };
    fs.writeFileSync(lockFile, `${JSON.stringify(updated, null, 2)}\n`);
    try {
      switchAccount(provider, rc, opts);
      if (rc.labels.working) provider.addLabel({ project, number, label: rc.labels.working });
    } catch (error) {
      console.error(`label refresh failed (lock kept): ${error.message}`);
    }
    const state = readState(configFile(opts));
    state.active = updated;
    state.last_run = new Date().toISOString();
    writeState(state, configFile(opts));
    console.log(JSON.stringify(updated, null, 2));
    return 0;
  }

  const lock = {
    provider: rc.provider,
    repo: project,
    issue: number,
    branch: opts.branch ?? null,
    claimed_at: new Date().toISOString(),
    local_only: rc.local_only,
  };
  try {
    acquireLock(lock, { file: lockFile, force: !!opts.force });
  } catch (error) {
    throw new CliError(error.message);
  }

  try {
    if (opts.force && previous) {
      try {
        const old = context(cfg, previous.repo);
        switchAccount(old.provider, old.rc, opts);
        if (old.rc.labels.working) {
          old.provider.removeLabel({
            project: previous.repo,
            number: previous.issue,
            label: old.rc.labels.working,
          });
        }
      } catch (error) {
        console.error(`previous lock cleanup failed: ${error.message}`);
      }
    }
    switchAccount(provider, rc, opts);
    if (rc.labels.working) provider.addLabel({ project, number, label: rc.labels.working });
  } catch (error) {
    clearLock(lockFile);
    throw error;
  }

  const state = readState(configFile(opts));
  state.active = lock;
  state.last_run = new Date().toISOString();
  writeState(state, configFile(opts));
  console.log(JSON.stringify(lock, null, 2));
  return 0;
}

function cmdRelease(opts) {
  const lockFile = lockPath(configFile(opts));
  let lock;
  try {
    lock = readLock(lockFile);
  } catch (error) {
    if (!opts.force) {
      throw new CliError(`Lock is corrupt: ${error.message}; release --force to clear`);
    }
    fs.unlinkSync(lockFile);
    const state = readState(configFile(opts));
    state.active = null;
    state.last_run = new Date().toISOString();
    writeState(state, configFile(opts));
    console.log(JSON.stringify({ released: true, force: true, reason: 'corrupt lock cleared' }, null, 2));
    return 0;
  }

  if (!lock) {
    console.log(JSON.stringify({ released: false, reason: 'no active lock' }, null, 2));
    return 0;
  }

  const result = opts.result ?? 'none';
  if (!['done', 'blocked', 'review', 'needs-info', 'none'].includes(result)) {
    throw new CliError('--result must be done, blocked, review, needs-info or none');
  }

  let cfg = null;
  try {
    cfg = loadConfig(opts.config);
  } catch (error) {
    if (!opts.force) throw new CliError(error.message, 2);
  }

  let rc = null;
  let provider = null;
  if (cfg) {
    try {
      ({ rc, provider } = context(cfg, lock.repo));
    } catch (error) {
      if (!opts.force) throw error;
    }
  }

  if (rc && provider) {
    // Label writes are best-effort: the lock must always clear, otherwise a
    // deleted label or a flaky host would hold the global queue forever.
    try {
      switchAccount(provider, rc, opts);
    } catch (error) {
      console.error(`account switch failed (continuing): ${error.message}`);
    }
    if (rc.labels.working) {
      try {
        provider.removeLabel({ project: lock.repo, number: lock.issue, label: rc.labels.working });
      } catch (error) {
        console.error(`removing "${rc.labels.working}" failed (continuing): ${error.message}`);
      }
    }
    const target = result === 'done'
      ? rc.labels.done
      : result === 'blocked'
        ? rc.labels.blocked
        : result === 'review'
          ? rc.labels.review
          : result === 'needs-info'
            ? rc.labels.needs_info
            : null;
    if (target) {
      try {
        provider.addLabel({ project: lock.repo, number: lock.issue, label: target });
      } catch (error) {
        console.error(`adding "${target}" failed (continuing): ${error.message}`);
      }
    }
  } else {
    console.error('config or project unavailable; lock cleared without label cleanup');
  }

  clearLock(lockFile);
  const state = readState(configFile(opts));
  state.active = null;
  state.last_run = new Date().toISOString();
  writeState(state, configFile(opts));
  console.log(JSON.stringify({ released: true, result, lock }, null, 2));
  return 0;
}

function cmdLabel(opts) {
  const cfg = requireConfig(opts);
  const [project, issue, action, ...labelParts] = opts._;
  if (!project || !issue || !['add', 'remove'].includes(action) || labelParts.length === 0) {
    throw new CliError('usage: label <project> <issue> add|remove <label>');
  }
  const { rc, provider } = context(cfg, project);
  assertEnabled(rc, project);
  switchAccount(provider, rc, opts);
  const label = labelParts.join(' ');
  if (action === 'add') provider.addLabel({ project, number: Number(issue), label });
  else provider.removeLabel({ project, number: Number(issue), label });
  console.log(JSON.stringify({ project, issue: Number(issue), action, label }, null, 2));
  return 0;
}

function cmdComment(opts) {
  const cfg = requireConfig(opts);
  const [project, number] = requirePositional(
    opts._.slice(0, 2),
    'comment <project> <number> --body-file <f> [--kind issue|change]',
  );
  const kind = opts.kind ?? 'issue';
  if (!['issue', 'change'].includes(kind)) throw new CliError('--kind must be issue or change');
  const body = bodyFromFile(opts['body-file']);
  const { rc, provider } = context(cfg, project);
  assertEnabled(rc, project);
  switchAccount(provider, rc, opts);
  provider.comment({ project, number: Number(number), body, kind });
  console.log(JSON.stringify({ commented: true, project, number: Number(number), kind }, null, 2));
  return 0;
}

function cmdChangeCreate(opts) {
  const cfg = requireConfig(opts);
  const [project] = requirePositional(
    opts._.slice(0, 1),
    'change-create <project> --head <b> --base <b> --title <t> --body-file <f> [--draft]',
  );
  if (!opts.head || opts.head === true || !opts.base || opts.base === true ||
      !opts.title || opts.title === true || !opts['body-file'] || opts['body-file'] === true) {
    throw new CliError('change-create requires --head, --base, --title and --body-file');
  }
  bodyFromFile(opts['body-file']);
  const { rc, provider } = context(cfg, project);
  assertEnabled(rc, project);
  switchAccount(provider, rc, opts);
  const result = provider.createChange({
    project,
    head: String(opts.head),
    base: String(opts.base),
    title: String(opts.title),
    bodyFile: path.resolve(String(opts['body-file'])),
    draft: !!opts.draft,
  });
  console.log(JSON.stringify(result, null, 2));
  return 0;
}

function cmdChecks(opts) {
  const cfg = requireConfig(opts);
  const [project, number] = requirePositional(
    opts._.slice(0, 2),
    'checks <project> <number> [--watch] [--interval <s>]',
  );
  const { rc, provider } = context(cfg, project);
  assertEnabled(rc, project);
  switchAccount(provider, rc, opts);
  const raw = provider.checks({
    project,
    number: Number(number),
    required: true,
    watch: !!opts.watch,
    interval: Number(opts.interval ?? 10),
  });
  // A killed process or an undocumented status is never "green".
  const status = raw === 0 || raw === 8 ? raw : 1;
  console.log(JSON.stringify({
    project,
    number: Number(number),
    status,
    green: status === 0,
    pending: status === 8,
  }, null, 2));
  return status;
}

function cmdMerge(opts) {
  const cfg = requireConfig(opts);
  const [project, number] = requirePositional(opts._.slice(0, 2), 'merge <project> <number>');
  const { rc, provider } = context(cfg, project);
  assertEnabled(rc, project);
  if (!rc.auto_merge) {
    throw new CliError(`auto_merge is false for ${project}; leave the change request for a human`);
  }
  switchAccount(provider, rc, opts);

  // Fail closed: a provider that does not report these fields is not evidence
  // that the change request is mergeable.
  const view = provider.viewChange({ project, number: Number(number) });
  if (view.state !== 'OPEN' || view.isDraft !== false) {
    throw new CliError(`change request is ${view.state}${view.isDraft ? ' (draft)' : ''}; merge refused`);
  }
  if (view.mergeable !== 'MERGEABLE') {
    throw new CliError(`change request is not mergeable (${view.mergeable ?? 'unknown'}); merge refused`);
  }
  // Allowlist, not denylist: an undocumented state never reaches `merge`.
  // UNSTABLE/HAS_HOOKS are safe here because required checks are enforced below.
  if (!['CLEAN', 'HAS_HOOKS', 'UNSTABLE'].includes(view.mergeStateStatus)) {
    throw new CliError(`merge state is ${view.mergeStateStatus ?? 'unknown'}; merge refused`);
  }

  const markerAuthors = new Set(rc.trusted_authors);
  if (rc.account) markerAuthors.add(rc.account);
  const markedByTrusted = (marker) => (view.comments ?? []).some((comment) => (
    (comment.body ?? '').includes(marker) && markerAuthors.has(comment.author?.login)
  ));
  if (!markedByTrusted(REVIEW_MARKER)) {
    throw new CliError('missing independent review marker by a trusted author; merge refused');
  }
  if (!markedByTrusted(EVIDENCE_MARKER)) {
    throw new CliError('missing evidence marker by a trusted author; merge refused');
  }

  const status = provider.checks({ project, number: Number(number), required: true });
  if (status !== 0) {
    throw new CliError(
      status === 8
        ? 'required checks still pending; merge refused'
        : 'required checks are not green or unavailable; merge refused',
    );
  }

  const result = provider.merge({ project, number: Number(number), method: rc.merge_method });
  console.log(JSON.stringify({
    merged: true,
    project,
    number: Number(number),
    url: view.url ?? null,
    ...result,
  }, null, 2));
  return 0;
}

function cmdEvidence(opts) {
  const cfg = requireConfig(opts);
  const [project, issue] = requirePositional(
    opts._.slice(0, 2),
    'evidence <project> <issue> --dir <dir>',
  );
  if (!opts.dir || opts.dir === true) throw new CliError('--dir is required');
  const { rc, provider } = context(cfg, project);
  assertEnabled(rc, project);
  const result = publishEvidence({
    project,
    issue,
    dir: String(opts.dir),
    branchPrefix: rc.evidence_branch_prefix,
    allowSecretLike: !!opts['allow-secret-like'],
    rawUrl: (args) => provider.rawUrl(args),
  });
  console.log(JSON.stringify(result, null, 2));
  return 0;
}

function cmdEnsureLabels(opts) {
  const cfg = requireConfig(opts);
  const projects = opts.project ? [String(opts.project)] : enabledRepos(cfg);
  const definitions = {
    working: { color: 'FBCA04', description: 'The issue agent is working on this' },
    review: { color: '1D76DB', description: 'Change request open, evidence/review pending' },
    done: { color: '0E8A16', description: 'Implemented and merged' },
    blocked: { color: 'B60205', description: 'Needs a human decision' },
    needs_info: { color: 'D876E3', description: 'Not actionable yet' },
  };

  for (const project of projects) {
    const { rc, provider } = context(cfg, project);
    if (!rc.enabled) continue;
    switchAccount(provider, rc, opts);
    for (const [role, definition] of Object.entries(definitions)) {
      const name = rc.labels[role];
      if (!name) continue;
      provider.ensureLabel({ project, name, ...definition });
      console.log(`${project}: ${name} (${role})`);
    }
  }
  return 0;
}

function cmdCaptureModel(opts) {
  const file = process.env.OPENCODE_CONFIG ||
    path.join(os.homedir(), '.config', 'opencode', 'opencode.jsonc');
  if (!fs.existsSync(file)) throw new CliError(`OpenCode config not found: ${file}`);
  const cfg = parseJsonc(fs.readFileSync(file, 'utf8'), file);
  const model = cfg.agents?.general?.model ?? cfg.agents?.explore?.model ?? cfg.model;
  if (!model) {
    throw new CliError(`No model in ${file} (agents.general.model, agents.explore.model or model)`);
  }
  if (opts.write) setModel(opts, model);
  console.log(model);
  return 0;
}

function cmdSetModel(opts) {
  const [model] = requirePositional(opts._, 'set-model <provider/model>');
  setModel(opts, model);
  console.log(model);
  return 0;
}

function setModel(opts, model) {
  const file = opts.config ?? configPath();
  if (!fs.existsSync(file)) throw new CliError(`Config not found: ${file}`, 2);
  let text = fs.readFileSync(file, 'utf8');
  const pattern = /("model"\s*:\s*)"[^"]*"/;
  if (pattern.test(text)) {
    text = text.replace(pattern, `$1${JSON.stringify(model)}`);
  } else {
    text = text.replace('{', `{\n  "model": ${JSON.stringify(model)},`);
  }
  parseJsonc(text, file);
  fs.writeFileSync(file, text);
}

const COMMANDS = {
  status: cmdStatus,
  list: cmdList,
  view: cmdView,
  account: cmdAccount,
  claim: cmdClaim,
  release: cmdRelease,
  label: cmdLabel,
  comment: cmdComment,
  'change-create': cmdChangeCreate,
  checks: cmdChecks,
  merge: cmdMerge,
  evidence: cmdEvidence,
  'ensure-labels': cmdEnsureLabels,
  'capture-model': cmdCaptureModel,
  'set-model': cmdSetModel,
};

const [command = 'help', ...rest] = process.argv.slice(2);
const opts = parseArgs(rest);
let exitCode = 0;

try {
  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(HELP);
  } else {
    const handler = COMMANDS[command];
    if (!handler) throw new CliError(`Unknown command "${command}"\n\n${HELP}`);
    exitCode = handler(opts) ?? 0;
  }
} catch (error) {
  console.error(error.message);
  exitCode = error.exitCode ?? 1;
}

process.exitCode = exitCode;
