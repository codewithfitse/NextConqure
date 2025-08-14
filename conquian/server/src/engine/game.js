const { createDeck, shuffle } = require('./cards');
const { isValidSet, isValidRun, canLayoff, canDiscard } = require('./rules');
const { rid } = require('../util/id');

function deal(deck, players) {
	const hands = new Map();
	for (const p of players) hands.set(p.id, []);
	for (let i = 0; i < 10; i++) {
		for (const p of players) {
			const card = deck.shift();
			hands.get(p.id).push(card);
		}
	}
	return hands;
}

function startGame(roomId, players) {
	const deck = shuffle(createDeck());
	const hands = deal(deck, players);
	const currentPlayerId = players[Math.floor(Math.random() * players.length)].id;
	return {
		roomId,
		status: 'active',
		players: players.map((p) => ({ ...p, hand: hands.get(p.id) })),
		currentPlayerId,
		winnerId: null,
		deck,
		discardPile: [],
		melds: [],
		lastAction: 'start',
		drawnFromDiscardCardId: null,
		hasDrawn: false,
	};
}

function findPlayer(state, playerId) {
	const p = state.players.find((pl) => pl.id === playerId);
	if (!p) throw new Error('player not found');
	return p;
}

function assertTurn(state, playerId) {
	if (state.currentPlayerId !== playerId) throw new Error('not your turn');
}

function draw(state, playerId, source) {
	assertTurn(state, playerId);
	if (state.hasDrawn) throw new Error('already drew');
	if (source === 'stock') {
		if (state.deck.length === 0) throw new Error('stock empty');
		const card = state.deck.shift();
		findPlayer(state, playerId).hand.push(card);
		state.hasDrawn = true;
		state.lastAction = 'draw:stock';
		return state;
	}
	if (source === 'discard') {
		if (state.discardPile.length === 0) throw new Error('discard empty');
		const card = state.discardPile.shift();
		findPlayer(state, playerId).hand.push(card);
		state.hasDrawn = true;
		state.drawnFromDiscardCardId = card.id;
		state.lastAction = 'draw:discard';
		return state;
	}
	throw new Error('invalid draw source');
}

function ensureHasCards(player, cardIds) {
	const ids = new Set(player.hand.map((c) => c.id));
	for (const id of cardIds) if (!ids.has(id)) throw new Error('card not in hand');
}

function takeCardsFromHand(player, cardIds) {
	const picked = [];
	player.hand = player.hand.filter((c) => {
		if (cardIds.includes(c.id)) {
			picked.push(c);
			return false;
		}
		return true;
	});
	return picked;
}

function meld(state, playerId, payload) {
	assertTurn(state, playerId);
	if (!state.hasDrawn) throw new Error('must draw first');
	const player = findPlayer(state, playerId);
	ensureHasCards(player, payload.cardIds);
	const picked = takeCardsFromHand(player, payload.cardIds);
	const valid = payload.kind === 'set' ? isValidSet(picked) : isValidRun(picked);
	if (!valid) {
		player.hand.push(...picked);
		throw new Error('invalid meld');
	}
	// If drew from discard, ensure that card used in this turn before discard
	if (state.drawnFromDiscardCardId) {
		const used = picked.some((c) => c.id === state.drawnFromDiscardCardId);
		if (!used) {
			player.hand.push(...picked);
			throw new Error('must use drawn discard card this turn');
		}
	}
	state.melds.push({ id: `meld-${rid(8)}`, kind: payload.kind, cards: picked, ownerId: playerId });
	state.lastAction = 'meld';
	return state;
}

function layoff(state, playerId, payload) {
	assertTurn(state, playerId);
	if (!state.hasDrawn) throw new Error('must draw first');
	const player = findPlayer(state, playerId);
	const target = state.melds.find((m) => m.id === payload.meldId);
	if (!target) throw new Error('meld not found');
	ensureHasCards(player, payload.cardIds);
	const picked = takeCardsFromHand(player, payload.cardIds);
	if (!canLayoff(target, picked)) {
		player.hand.push(...picked);
		throw new Error('invalid layoff');
	}
	// discard-draw rule enforcement
	if (state.drawnFromDiscardCardId) {
		const used = picked.some((c) => c.id === state.drawnFromDiscardCardId);
		if (!used) {
			player.hand.push(...picked);
			throw new Error('must use drawn discard card this turn');
		}
	}
	target.cards.push(...picked);
	state.lastAction = 'layoff';
	return state;
}

function endTurn(state) {
	const idx = state.players.findIndex((p) => p.id === state.currentPlayerId);
	state.currentPlayerId = state.players[(idx + 1) % state.players.length].id;
	state.hasDrawn = false;
	state.drawnFromDiscardCardId = null;
}

function checkWin(state, player) {
	if (player.hand.length === 0) {
		state.status = 'finished';
		state.winnerId = player.id;
	}
}

function discard(state, playerId, card) {
	assertTurn(state, playerId);
	if (!state.hasDrawn) throw new Error('must draw first');
	const player = findPlayer(state, playerId);
    // If drew from discard this turn, they must have used that card in a meld/layoff
    if (state.drawnFromDiscardCardId) {
        const stillInHand = player.hand.some((c) => c.id === state.drawnFromDiscardCardId);
        if (stillInHand) {
            throw new Error('must use drawn discard card this turn');
        }
    }
	if (!canDiscard(player, card)) throw new Error('cannot discard');
	player.hand = player.hand.filter((c) => c.id !== card.id);
	state.discardPile.unshift(card);
	state.lastAction = 'discard';
	checkWin(state, player);
	if (state.status !== 'finished') endTurn(state);
	return state;
}

module.exports = {
	startGame,
	draw,
	meld,
	layoff,
	discard,
};


