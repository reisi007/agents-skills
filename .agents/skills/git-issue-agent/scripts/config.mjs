import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function configDir() {
  return process.env.GIT_ISSUE_AGENT_HOME ||
    path.join(os.homedir(), '.config', 'opencode', 'git-issue-agent');
}

export function configPath() {
  return process.env.GIT_ISSUE_AGENT_CONFIG || path.join(configDir(), 'config.jsonc');
}

// A `--config <path>` run keeps its state/lock next to that file, so a test
// config can never touch the live global queue.
export function statePath(configFile) {
  return configFile
    ? path.join(path.dirname(path.resolve(configFile)), 'state.json')
    : path.join(configDir(), 'state.json');
}

export function lockPath(configFile) {
  return configFile
    ? path.join(path.dirname(path.resolve(configFile)), 'lock.json')
    : path.join(configDir(), 'lock.json');
}

// Position of the next non-whitespace, non-comment character, so a trailing
// comma is still recognized when a comment follows it.
function nextSignificant(text, start) {
  let j = start;
  while (j < text.length) {
    if (/\s/.test(text[j])) { j++; continue; }
    if (text[j] === '/' && text[j + 1] === '/') {
      j += 2;
      while (j < text.length && text[j] !== '\n') j++;
      continue;
    }
    if (text[j] === '/' && text[j + 1] === '*') {
      j += 2;
      while (j < text.length && !(text[j] === '*' && text[j + 1] === '/')) j++;
      j += 2;
      continue;
    }
    break;
  }
  return j;
}

// JSONC: // and /* */ comments, plus trailing commas, kept outside strings.
export function parseJsonc(text, source = 'config.jsonc') {
  let out = '';
  let inString = false;
  let escape = false;
  let line = false;
  let block = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (line) {
      if (c === '\n') { line = false; out += c; }
      continue;
    }
    if (block) {
      if (c === '*' && n === '/') { block = false; i++; }
      continue;
    }
    if (inString) {
      out += c;
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; out += c; continue; }
    if (c === '/' && n === '/') { line = true; i++; continue; }
    if (c === '/' && n === '*') { block = true; i++; continue; }
    if (c === ',') {
      const j = nextSignificant(text, i + 1);
      if (text[j] === '}' || text[j] === ']') continue;
    }
    out += c;
  }
  try {
    return JSON.parse(out);
  } catch (error) {
    throw new Error(`${source}: ${error.message}`);
  }
}

export function readJsonc(file) {
  return parseJsonc(fs.readFileSync(file, 'utf8'), file);
}

export function loadConfig(file = configPath()) {
  if (!fs.existsSync(file)) {
    throw new Error(`Config not found: ${file} — run setup, then fill the reported fields`);
  }
  const cfg = readJsonc(file);
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
    throw new Error(`${file}: config must be a JSON object`);
  }
  if (!cfg.repos || typeof cfg.repos !== 'object' || Array.isArray(cfg.repos)) {
    throw new Error(`${file}: "repos" must be an object keyed by project id`);
  }
  return { ...cfg, __file: file };
}

export function repoConfig(cfg, project) {
  const own = cfg.repos?.[project];
  if (!own || typeof own !== 'object') {
    throw new Error(`Project "${project}" is not in ${cfg.__file ?? 'the config'}`);
  }
  const defaults = cfg.defaults ?? {};
  const labels = { ...(defaults.labels ?? {}), ...(own.labels ?? {}) };
  return {
    project,
    provider: own.provider ?? defaults.provider ?? cfg.provider ?? 'github',
    account: own.account ?? cfg.accounts?.[0] ?? null,
    enabled: own.enabled ?? defaults.enabled ?? true,
    local_only: own.local_only ?? defaults.local_only ?? false,
    auto_merge: own.auto_merge ?? defaults.auto_merge ?? true,
    base_branch: own.base_branch ?? defaults.base_branch ?? 'main',
    trusted_authors: Array.isArray(own.trusted_authors)
      ? own.trusted_authors
      : (cfg.trusted_authors ?? []),
    labels,
    commands: own.commands ?? {},
    evidence_branch_prefix: own.evidence?.branch_prefix ?? cfg.evidence?.branch_prefix ?? 'agent-evidence',
    merge_method: own.merge_method ?? cfg.merge?.method ?? 'squash',
    raw: own,
  };
}

export function enabledRepos(cfg) {
  return Object.keys(cfg.repos).filter((project) => repoConfig(cfg, project).enabled);
}

export function readState(configFile) {
  const file = statePath(configFile);
  if (!fs.existsSync(file)) return { active: null, last_run: null };
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { active: null, last_run: null };
  }
}

export function writeState(state, configFile) {
  const file = statePath(configFile);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
}

export function readLock(file = lockPath()) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function acquireLock(lock, { file = lockPath(), force = false } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (force && fs.existsSync(file)) fs.unlinkSync(file);

  let fd;
  try {
    fd = fs.openSync(file, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') {
      const current = readLock(file);
      throw new Error(
        `Queue is locked by ${current?.repo}#${current?.issue} since ${current?.claimed_at}; ` +
        'release --force only for a stale run'
      );
    }
    throw error;
  }
  try {
    fs.writeFileSync(fd, `${JSON.stringify(lock, null, 2)}\n`);
  } finally {
    fs.closeSync(fd);
  }
}

export function clearLock(file = lockPath()) {
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
