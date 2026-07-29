import { test } from 'node:test';
import assert from 'node:assert/strict';
import { search } from './search.mjs';

const entry = (overrides) => ({
  id: 'x',
  category: 'skills',
  title: '',
  tagline: '',
  author: null,
  repo: null,
  stars: 0,
  downloads: 0,
  tags: [],
  href: '/skills/x',
  ...overrides,
});

test('regression (CLI 0.1.0 pre-publish bug): stub fork cannot outrank the popular original', () => {
  const entries = [
    entry({ id: 'fork', title: 'tdd', tagline: 'tdd', stub: true, downloads: 2834 }),
    entry({ id: 'original', title: 'tdd', tagline: 'Test-driven development with vertical slices.', downloads: 501139 }),
  ];
  assert.equal(search(entries, 'tdd').results[0].id, 'original');
});

test('stub loses an exact tie to a non-stub even with equal popularity', () => {
  const entries = [
    entry({ id: 'stub', title: 'qa', tagline: 'qa', stub: true, downloads: 100 }),
    entry({ id: 'real', title: 'qa', tagline: 'Quality assurance workflows.', downloads: 100 }),
  ];
  assert.equal(search(entries, 'qa').results[0].id, 'real');
});

test('exact title beats substring; AND semantics enforced', () => {
  const entries = [
    entry({ id: 'sub', title: 'my-tdd-helper' }),
    entry({ id: 'exact', title: 'tdd' }),
    entry({ id: 'partial', title: 'pdf viewer' }),
  ];
  assert.equal(search(entries, 'tdd').results[0].id, 'exact');
  assert.deepEqual(
    search(entries, 'pdf extraction').results.map((r) => r.id),
    [],
  );
});

test('description matches count, weakest', () => {
  const entries = [
    entry({ id: 'desc', title: 'scrapling', description: 'browser fingerprint impersonation and dynamic fetching' }),
    entry({ id: 'title', title: 'fingerprint' }),
  ];
  const { results } = search(entries, 'fingerprint');
  assert.deepEqual(results.map((r) => r.id), ['title', 'desc']);
});

test('popularity never overrides match quality', () => {
  const entries = [
    entry({ id: 'famous-weak', title: 'kubernetes helper', tagline: 'ship it', stars: 90000 }),
    entry({ id: 'obscure-exact', title: 'ship', stars: 2 }),
  ];
  assert.equal(search(entries, 'ship').results[0].id, 'obscure-exact');
});

test('total reflects all matches; limit caps results', () => {
  const entries = Array.from({ length: 30 }, (_, i) => entry({ id: `e${i}`, title: `tool ${i}` }));
  const { total, results } = search(entries, 'tool', { limit: 5 });
  assert.equal(total, 30);
  assert.equal(results.length, 5);
});
