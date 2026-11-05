import { github } from './github.mjs';
import { gitlab } from './gitlab.mjs';

export const providers = { github, gitlab };

export function getProvider(name = 'github') {
  const provider = providers[name];
  if (!provider) {
    throw new Error(
      `Unknown provider "${name}". Registered: ${Object.keys(providers).join(', ')}. ` +
      'Add one in scripts/providers/index.mjs (see references/providers.md).'
    );
  }
  return provider;
}
