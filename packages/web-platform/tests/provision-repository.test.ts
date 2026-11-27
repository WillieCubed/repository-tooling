import { expect, test } from 'vitest';
import { reconcileResources } from '../src/provision-reconcile.ts';
import { provisionRepository } from '../src/provision-repository.ts';

const desired = {
  full_name: 'example-org/new-lab',
  private: false,
  archived: false,
  default_branch: 'main',
  allow_merge_commit: false,
  allow_squash_merge: false,
  allow_rebase_merge: true,
};

test('creates a missing public organization repository once', async () => {
  let state: unknown = null;
  const writes: { method: string; endpoint: string; body: unknown }[] = [];
  const resource = provisionRepository(
    {
      repository: desired.full_name,
      branch: 'main',
      ownerType: 'Organization',
      visibility: 'public',
    },
    () => Promise.resolve(state),
    (method, endpoint, body) => {
      writes.push({ method, endpoint, body });
      state = desired;
      return Promise.resolve();
    },
  );

  expect((await reconcileResources([resource], false)).operations[0]?.status).toBe('planned');
  expect(writes).toEqual([]);
  expect((await reconcileResources([resource], true)).ok).toBe(true);
  expect(writes).toEqual([
    {
      method: 'POST',
      endpoint: 'orgs/example-org/repos',
      body: {
        name: 'new-lab',
        private: false,
        auto_init: false,
        allow_merge_commit: false,
        allow_squash_merge: false,
        allow_rebase_merge: true,
      },
    },
  ]);
  expect((await reconcileResources([resource], true)).changed).toBe(false);
  expect(writes).toHaveLength(1);
});

test('reconciles merge settings without publishing or unarchiving an existing repository', async () => {
  let state: unknown = { ...desired, private: true, archived: true, allow_merge_commit: true };
  const writes: { method: string; endpoint: string; body: Record<string, unknown> }[] = [];
  const resource = provisionRepository(
    { repository: desired.full_name, branch: 'main' },
    () => Promise.resolve(state),
    (method, endpoint, body) => {
      writes.push({ method, endpoint, body });
      state = { ...(state as Record<string, unknown>), ...body };
      return Promise.resolve();
    },
  );

  expect((await reconcileResources([resource], true)).ok).toBe(true);
  expect(writes).toEqual([
    {
      method: 'PATCH',
      endpoint: 'repos/example-org/new-lab',
      body: {
        allow_merge_commit: false,
        allow_squash_merge: false,
        allow_rebase_merge: true,
      },
    },
  ]);
  expect(state).toMatchObject({ private: true, archived: true, default_branch: 'main' });
});

test('creates an explicitly private personal repository through the user endpoint', async () => {
  let state: unknown = null;
  const writes: { endpoint: string; body: unknown }[] = [];
  const resource = provisionRepository(
    { repository: desired.full_name, branch: 'main', ownerType: 'User', visibility: 'private' },
    (endpoint: string) => Promise.resolve(endpoint === 'user' ? { login: 'example-org' } : state),
    (_method, endpoint, body) => {
      writes.push({ endpoint, body });
      state = { ...desired, private: true };
      return Promise.resolve();
    },
  );
  expect((await reconcileResources([resource], true)).ok).toBe(true);
  expect(writes).toEqual([
    {
      endpoint: 'user/repos',
      body: {
        name: 'new-lab',
        private: true,
        auto_init: false,
        allow_merge_commit: false,
        allow_squash_merge: false,
        allow_rebase_merge: true,
      },
    },
  ]);
});

test('personal creation verifies the authenticated owner before any write', async () => {
  for (const account of [{ login: 'different-owner' }, null]) {
    const writes: unknown[] = [];
    const resource = provisionRepository(
      { repository: desired.full_name, branch: 'main', ownerType: 'User', visibility: 'private' },
      (endpoint: string) => Promise.resolve(endpoint === 'user' ? account : null),
      (...args) => {
        writes.push(args);
        return Promise.resolve();
      },
    );
    expect((await reconcileResources([resource], true)).operations[0]?.status).toBe('blocked');
    expect(writes).toEqual([]);
  }
});

test('missing repository creation requires explicit owner type and visibility', async () => {
  for (const options of [{}, { ownerType: 'User' }, { visibility: 'public' }]) {
    const writes: unknown[] = [];
    const resource = provisionRepository(
      { repository: desired.full_name, branch: 'main', ...options },
      () => Promise.resolve(null),
      (...args) => {
        writes.push(args);
        return Promise.resolve();
      },
    );
    const result = await reconcileResources([resource], true);
    expect(result.ok).toBe(false);
    expect(result.operations[0]?.status).toBe('blocked');
    expect(writes).toEqual([]);
  }
});

test('existing repository visibility and default-branch changes require separate review', async () => {
  for (const current of [
    { ...desired, private: true },
    { ...desired, default_branch: 'production' },
  ]) {
    const writes: unknown[] = [];
    const resource = provisionRepository(
      { repository: desired.full_name, branch: 'main', ownerType: 'User', visibility: 'public' },
      () => Promise.resolve(current),
      (...args) => {
        writes.push(args);
        return Promise.resolve();
      },
    );
    expect((await reconcileResources([resource], true)).operations[0]?.status).toBe('blocked');
    expect(writes).toEqual([]);
  }
});
