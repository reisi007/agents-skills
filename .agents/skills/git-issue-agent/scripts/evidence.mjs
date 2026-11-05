import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;

// Evidence must never publish a credential. Rename alone is not enough: the
// content check belongs to the agent before publishing; these names are the
// last mechanical guard.
const SECRET_LIKE = /(^|\/)(\.env(\..*)?|\.npmrc|\.netrc|id_rsa|id_ed25519|.*\.(pem|key|p12|pfx|p8)|.*(secret|token|credential).*)$/i;
const DOTFILE = /(^|\/)\.[^/]+$/;

function git(args, { cwd, input, env } = {}) {
  const result = spawnSync('git', args, { cwd, input, env, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || '').trim()}`);
  }
  return (result.stdout || '').trim();
}

function walk(root, current = root, out = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const abs = path.join(current, entry.name);
    if (entry.isDirectory()) walk(root, abs, out);
    else if (entry.isFile()) out.push(path.relative(root, abs));
  }
  return out;
}

function kind(name) {
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return 'image';
  if (/\.(mp4|webm|mov|mkv)$/i.test(name)) return 'video';
  if (/\.(log|txt|md|json)$/i.test(name)) return 'log';
  return 'file';
}

/**
 * Publish artifacts on an orphan evidence branch. Nothing is added to the
 * change request or the base branch; the branch is force-replaced per issue.
 * URLs use the evidence commit SHA, so deleting/refreshing the branch later
 * cannot silently change an already-posted verification comment.
 */
export function publishEvidence({
  project,
  issue,
  dir,
  branchPrefix = 'agent-evidence',
  allowSecretLike = false,
  rawUrl,
}) {
  if (!project || !issue) throw new Error('project and issue are required');
  if (!dir) throw new Error('--dir is required');
  if (!fs.existsSync(dir)) throw new Error(`Evidence directory not found: ${dir}`);

  const root = git(['rev-parse', '--show-toplevel']);
  const files = walk(dir).sort();
  if (files.length === 0) throw new Error(`No files in evidence directory: ${dir}`);

  const branch = `${branchPrefix}-issue-${issue}`;
  let totalBytes = 0;
  const entries = files.map((relative) => {
    if (!allowSecretLike && (SECRET_LIKE.test(relative) || DOTFILE.test(relative))) {
      throw new Error(`Refusing secret-like evidence file: ${relative} (redact/rename or pass --allow-secret-like)`);
    }
    const abs = path.join(dir, relative);
    const bytes = fs.statSync(abs).size;
    if (bytes > MAX_FILE_BYTES) {
      throw new Error(`${relative} is ${(bytes / 1024 / 1024).toFixed(1)} MB; compress it below 50 MB`);
    }
    totalBytes += bytes;
    const target = `issue-${issue}-${relative.replace(/[^A-Za-z0-9._-]+/g, '-')}`;
    const sha = git(['hash-object', '-w', abs], { cwd: root });
    return { source: relative, target, sha, bytes, kind: kind(relative) };
  });
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new Error(`Evidence is ${(totalBytes / 1024 / 1024).toFixed(1)} MB; the total cap is 100 MB`);
  }

  const treeInput = entries.map((entry) => `100644 blob ${entry.sha}\t${entry.target}`).join('\n') + '\n';
  const tree = git(['mktree'], { cwd: root, input: treeInput });

  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'git-issue-agent',
    GIT_AUTHOR_EMAIL: 'git-issue-agent@users.noreply.github.com',
    GIT_COMMITTER_NAME: 'git-issue-agent',
    GIT_COMMITTER_EMAIL: 'git-issue-agent@users.noreply.github.com',
  };
  const committed = spawnSync(
    'git',
    ['commit-tree', tree, '-m', `Evidence for ${project}#${issue}`],
    { cwd: root, env, encoding: 'utf8' },
  );
  if (committed.error) throw committed.error;
  if (committed.status !== 0) {
    throw new Error(`git commit-tree failed: ${(committed.stderr || '').trim()}`);
  }
  const commit = (committed.stdout || '').trim();

  git(['push', '--force', 'origin', `${commit}:refs/heads/${branch}`], { cwd: root });

  return {
    project,
    issue: Number(issue),
    branch,
    commit,
    files: entries.map((entry) => ({
      source: entry.source,
      name: entry.target,
      bytes: entry.bytes,
      kind: entry.kind,
      url: rawUrl({ project, ref: commit, path: entry.target }),
    })),
  };
}
