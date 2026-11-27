import { z } from 'zod';
import type { ProvisionResource } from './provision-reconcile.js';

const targetSchema = z.object({
  repository: z.string().regex(/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/),
  branch: z.string().min(1),
  ownerType: z.enum(['User', 'Organization']).optional(),
  visibility: z.enum(['private', 'public']).optional(),
});
const repositorySchema = z.object({
  full_name: z.string(),
  private: z.boolean(),
  archived: z.boolean(),
  default_branch: z.string(),
  allow_merge_commit: z.boolean(),
  allow_squash_merge: z.boolean(),
  allow_rebase_merge: z.boolean(),
});
type Write = (
  method: 'POST' | 'PATCH',
  endpoint: string,
  body: Record<string, unknown>,
) => Promise<void>;
type Read = (endpoint: string) => Promise<unknown>;

async function creationIntent(target: z.infer<typeof targetSchema>, read: Read) {
  const intent = z
    .object({
      ownerType: z.enum(['User', 'Organization']),
      visibility: z.enum(['private', 'public']),
    })
    .parse(target);
  if (intent.ownerType === 'User') {
    const [owner] = target.repository.split('/') as [string, string];
    const account = z.object({ login: z.string() }).parse(await read('user'));
    if (account.login.toLowerCase() !== owner.toLowerCase())
      throw new Error('The authenticated user must own the new personal repository.');
  }
  return intent;
}

export function provisionRepository(input: unknown, read: Read, write: Write): ProvisionResource {
  const target = targetSchema.parse(input);
  const [owner, name] = target.repository.split('/') as [string, string];
  const endpoint = `repos/${target.repository}`;
  const mergeSettings = {
    allow_merge_commit: false,
    allow_squash_merge: false,
    allow_rebase_merge: true,
  };
  return {
    id: 'github.repository',
    read: async () => {
      const current = await read(endpoint);
      if (current === null) {
        await creationIntent(target, read);
        return null;
      }
      const repository = repositorySchema.parse(current);
      if (repository.full_name.toLowerCase() !== target.repository.toLowerCase())
        throw new Error('Repository discovery returned a different target.');
      return repository;
    },
    desired: (current) => {
      if (current === null)
        return {
          full_name: target.repository,
          private: target.visibility === 'private',
          archived: false,
          default_branch: target.branch,
          ...mergeSettings,
        };
      const repository = repositorySchema.parse(current);
      if (
        repository.default_branch !== target.branch ||
        (target.visibility !== undefined &&
          repository.private !== (target.visibility === 'private'))
      )
        throw new Error('Visibility and default-branch changes require separate review.');
      return { ...repository, ...mergeSettings };
    },
    write: async (before) => {
      if (before !== null) return write('PATCH', endpoint, mergeSettings);
      const intent = await creationIntent(target, read);
      return write('POST', intent.ownerType === 'User' ? 'user/repos' : `orgs/${owner}/repos`, {
        name,
        private: intent.visibility === 'private',
        auto_init: false,
        ...mergeSettings,
      });
    },
  };
}
