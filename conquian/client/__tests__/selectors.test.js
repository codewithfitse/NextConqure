import { describe, it, expect } from 'vitest';

const buildMeldPayload = (cards) => ({ kind: 'set', cardIds: cards.map((c) => c.id) });

describe('client helpers', () => {
	it('builds MeldPayload from selected', () => {
		const cards = [
			{ id: 'a', rank: 'A', suit: 'hearts' },
			{ id: 'b', rank: 'A', suit: 'clubs' },
			{ id: 'c', rank: 'A', suit: 'spades' },
		];
		expect(buildMeldPayload(cards)).toEqual({ kind: 'set', cardIds: ['a', 'b', 'c'] });
	});
});


