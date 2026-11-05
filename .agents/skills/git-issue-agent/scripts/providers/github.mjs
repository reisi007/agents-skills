import { spawnSync } from 'node:child_process';

function gh(args, { input, allowFail = false } = {}) {
  const result = spawnSync('gh', args, { input, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFail) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(`gh ${args.join(' ')} failed (${result.status}): ${detail}`);
  }
  return {
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function json(args) {
  return JSON.parse(gh(args).stdout || '[]');
}

const MERGE_FLAGS = { squash: '--squash', merge: '--merge', rebase: '--rebase' };

export const github = {
  name: 'github',
  changeRequestTerm: 'PR',

  switchAccount(user) {
    gh(['auth', 'switch', '--user', user]);
  },

  listIssues({ project, limit = 100 }) {
    return json([
      'issue', 'list', '--repo', project, '--state', 'open', '--limit', String(limit),
      '--json', 'number,title,author,labels,createdAt,updatedAt,url',
    ]);
  },

  viewIssue({ project, number }) {
    return json([
      'issue', 'view', String(number), '--repo', project,
      '--json', 'number,title,body,author,labels,comments,url,state',
    ]);
  },

  addLabel({ project, number, label }) {
    gh(['issue', 'edit', String(number), '--repo', project, '--add-label', label]);
  },

  removeLabel({ project, number, label }) {
    gh(['issue', 'edit', String(number), '--repo', project, '--remove-label', label]);
  },

  comment({ project, number, body, kind = 'issue' }) {
    const command = kind === 'change' ? 'pr' : 'issue';
    gh([command, 'comment', String(number), '--repo', project, '--body', body]);
  },

  viewChange({ project, number }) {
    return json([
      'pr', 'view', String(number), '--repo', project,
      '--json', 'state,isDraft,url,headRefName,baseRefName,comments,mergeable,mergeStateStatus',
    ]);
  },

  checks({ project, number, required = true, watch = false, interval = 10 }) {
    const args = ['pr', 'checks', String(number), '--repo', project];
    if (required) args.push('--required');
    if (watch) args.push('--watch', '--interval', String(interval));
    return gh(args, { allowFail: true }).status;
  },

  merge({ project, number, method = 'squash' }) {
    const flag = MERGE_FLAGS[method];
    if (!flag) throw new Error(`Unsupported merge method "${method}" (use squash, merge or rebase)`);
    gh(['pr', 'merge', String(number), '--repo', project, flag, '--delete-branch']);
    return { method };
  },

  createChange({ project, head, base, title, bodyFile, draft = false }) {
    const args = [
      'pr', 'create', '--repo', project, '--head', head, '--base', base,
      '--title', title, '--body-file', bodyFile,
    ];
    if (draft) args.push('--draft');
    const output = gh(args).stdout;
    const url = output.split('\n').map((line) => line.trim()).find((line) => line.startsWith('https://'));
    const number = url
      ? Number(url.match(/\/(?:pull|pulls)\/(\d+)/)?.[1] ?? 0) || null
      : null;
    return { url: url ?? null, number, head, base };
  },

  ensureLabel({ project, name, color, description }) {
    gh([
      'label', 'create', name, '--repo', project,
      '--color', color, '--description', description, '--force',
    ]);
  },

  rawUrl({ project, ref, path: filePath }) {
    return `https://raw.githubusercontent.com/${project}/${ref}/${encodePath(filePath)}`;
  },
};

function encodePath(filePath) {
  return filePath.split('/').map(encodeURIComponent).join('/');
}
