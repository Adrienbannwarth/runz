import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIKED, clip, pick, tally, type Feedback } from '../lib/feedback-core.ts';

test('Avis : choix filtrés, textes coupés, comptage', () => {
  assert.deepEqual(pick(['Les boosts', 'Inventé', 'Les boosts'], LIKED), ['Les boosts']);
  assert.equal(clip('  salut  ', 300), 'salut');
  assert.equal(clip('   ', 300), null);
  assert.equal(clip('x'.repeat(500), 300)?.length, 300);
  const row = (liked: string[]) => ({ liked, disliked: [], sports: [] }) as unknown as Feedback;
  const t = tally([row(['Les boosts']), row(['Les boosts', 'Le Rewind'])], 'liked', LIKED);
  assert.deepEqual(t.slice(0, 2), [{ label: 'Les boosts', n: 2 }, { label: 'Le Rewind', n: 1 }]);
});
