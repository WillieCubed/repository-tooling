import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { githubReader } from '../src/github-read.ts';

test('reads the authenticated account without permitting arbitrary account endpoints', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'personal-github-reader-'));
  const log = path.join(directory, 'requests.json');
  await writeFile(
    path.join(directory, 'gh'),
    `#!${process.execPath}
require('node:fs').writeFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)));
process.stdout.write(JSON.stringify([{ login: 'personal-owner' }]));
`,
    { mode: 0o755 },
  );
  const previous = process.env.PATH;
  process.env.PATH = `${directory}${path.delimiter}${previous ?? ''}`;
  try {
    const read = githubReader(directory);
    await expect(read('user')).resolves.toEqual({ login: 'personal-owner' });
    expect(JSON.parse(await readFile(log, 'utf8'))).toEqual([
      'api',
      '--hostname',
      'github.com',
      '--method',
      'GET',
      '--paginate',
      '--slurp',
      'user',
    ]);
    for (const endpoint of ['user/repos', 'users/other-owner', 'repos/owner/repo/../secrets'])
      await expect(read(endpoint)).rejects.toThrow(/repository API path/);
  } finally {
    if (previous === undefined) delete process.env.PATH;
    else process.env.PATH = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
