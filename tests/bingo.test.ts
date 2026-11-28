import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BINGO_CELLS, BINGO_CENTER, DEFIS, gridFor } from '../lib/bingo-defis.ts';

test('BingoZ : grille 7 × 7, case du milieu imposée, « ? » pour les défis manquants, tirage stable', () => {
  const g = gridFor('equipe-1');
  assert.equal(g.length, BINGO_CELLS);
  assert.equal(g[BINGO_CENTER], 'center');
  assert.equal(g.filter((c) => c === null).length, BINGO_CELLS - 1 - DEFIS.length);
  assert.equal(new Set(g.filter((c) => c && c !== 'center').map((c) => (c as { id: number }).id)).size, DEFIS.length);
  assert.deepEqual(gridFor('equipe-1'), g);                    // même équipe, même grille
  assert.notDeepEqual(gridFor('equipe-2'), g);                 // autre équipe, autre placement
});
