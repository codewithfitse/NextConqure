const { createDeck, shuffle, RANKS, SUITS } = require('../src/engine/cards');

test('deck has 40 unique cards', () => {
	const deck = createDeck();
	expect(deck).toHaveLength(40);
	const ids = new Set(deck.map((c) => c.id));
	expect(ids.size).toBe(40);
});

test('ranks used are correct', () => {
	const deck = createDeck();
	const ranks = new Set(deck.map((c) => c.rank));
	for (const r of RANKS) expect(ranks.has(r)).toBe(true);
});

test('suits used are correct', () => {
	const deck = createDeck();
	const suits = new Set(deck.map((c) => c.suit));
	for (const s of SUITS) expect(suits.has(s)).toBe(true);
});

test('shuffle changes order (probabilistic)', () => {
	const deck = createDeck();
	const copy = deck.map((c) => c.id);
	const shuffled = shuffle(deck.slice()).map((c) => c.id);
	const sameOrder = copy.every((id, i) => id === shuffled[i]);
	// Very unlikely to be the same
	expect(sameOrder).toBe(false);
});


