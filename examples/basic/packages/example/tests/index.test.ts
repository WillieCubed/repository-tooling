import { expect, test } from 'vitest';

import { greet } from '../src/index.js';

test('greets by name', () => {
  expect(greet('world')).toBe('Hello, world!');
});
