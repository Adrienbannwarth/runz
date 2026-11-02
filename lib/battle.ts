import 'server-only';
import { db, must } from './db';
import type { Vote } from './battle-core';
export * from './battle-core';

export async function loadVotes(test = false): Promise<Vote[]> {
  return must(await db().from('votes').select('voter_id, a, b, winner, test').eq('test', test).limit(20000)) as Vote[];
}

export async function castVote(voterId: string, a: string, b: string, winner: string, test = false) {
  must(await db().from('votes').insert({ voter_id: voterId, a, b, winner, test }));
}
