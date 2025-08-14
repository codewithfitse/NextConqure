const { startGame, draw, meld, layoff, discard } = require('../src/engine/game');

function mkPlayers() {
	return [
		{ id: 'p1', nickname: 'a', hand: [], connected: true, isHost: true },
		{ id: 'p2', nickname: 'b', hand: [], connected: true, isHost: false },
	];
}

test('startGame deals 10 cards and sets current player', () => {
	const state = startGame('room', mkPlayers());
	for (const p of state.players) expect(p.hand.length).toBe(10);
	expect(state.deck.length).toBe(40 - 20);
	expect(state.currentPlayerId).not.toBeNull();
});

test('draw from stock then discard ends turn', () => {
	const s1 = startGame('room', mkPlayers());
	const pid = s1.currentPlayerId;
	const handBefore = s1.players.find((p) => p.id === pid).hand.length;
	draw(s1, pid, 'stock');
	const player = s1.players.find((p) => p.id === pid);
	const toDiscard = player.hand[0];
	discard(s1, pid, toDiscard);
	expect(s1.currentPlayerId).not.toBe(pid);
});

test('draw from discard requires using that card before discard', () => {
	const s1 = startGame('room', mkPlayers());
	const pid = s1.currentPlayerId;
	// Put a known card on discard
	const c = s1.deck.shift();
	s1.discardPile.unshift(c);
	draw(s1, pid, 'discard');
	const player = s1.players.find((p) => p.id === pid);
	// Attempt to discard the drawn card should fail via rule enforced in meld/layoff usage requirement
	expect(() => discard(s1, pid, c)).toThrow();
});


