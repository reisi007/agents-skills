function slot(method) {
  throw new Error(
    `Provider "gitlab" is a contract slot: ${method} is not implemented. ` +
    'Implement it in scripts/providers/gitlab.mjs (see references/providers.md).'
  );
}

function encodePath(filePath) {
  return filePath.split('/').map(encodeURIComponent).join('/');
}

export const gitlab = {
  name: 'gitlab',
  changeRequestTerm: 'MR',
  switchAccount: () => slot('switchAccount'),
  listIssues: () => slot('listIssues'),
  viewIssue: () => slot('viewIssue'),
  addLabel: () => slot('addLabel'),
  removeLabel: () => slot('removeLabel'),
  comment: () => slot('comment'),
  viewChange: () => slot('viewChange'),
  checks: () => slot('checks'),
  merge: () => slot('merge'),
  createChange: () => slot('createChange'),
  ensureLabel: () => slot('ensureLabel'),
  rawUrl({ project, ref, path: filePath }) {
    return `https://gitlab.com/${project}/-/raw/${ref}/${encodePath(filePath)}`;
  },
};
