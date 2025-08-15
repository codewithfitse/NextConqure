const { rid } = require('../util/id');

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['spades', 'hearts', 'diamonds', 'clubs', 'false'];
// ORDER used for sequencing (runs)
const RANK_ORDER = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13 };
// VALUE used for scoring (requested mapping)
const RANK_VALUE = { A: 11, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 10, Q: 10, K: 10 };

function createDeck() {
	const deck = [];
	for (const suit of SUITS) {
		if (suit === 'false') {
			// Exceptional suit: only two number cards in the deck, must be valid ranks
			for (const rank of ['joker', 'jocker']) {
				deck.push({ id: rid(8), rank, suit });
			}
			continue;
		}
		for (const rank of RANKS) {
			deck.push({ id: rid(8), rank, suit });
		}
	}
	return deck;
}

function shuffle(array) {
	const arr = array.slice();
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

function startGame(roomState) {
	// Ensure host starts first
	const host = roomState.players.find((p) => p.isHost);
	if (!host) throw new Error('NO_HOST');
	const nonHosts = roomState.players.filter((p) => !p.isHost);
	const ordered = [host, ...nonHosts];

	const players = ordered.map((p) => ({ id: p.id, nickname: p.nickname, hand: [] }));
	if (players.length < 2) throw new Error('NEED_2_PLAYERS');

	let deck = shuffle(createDeck());
	const discardPile = [];

	// Deal: host 14 cards (must discard first), others 13
	for (let pi = 0; pi < players.length; pi++) {
		const target = pi === 0 ? 14 : 13;
		for (let k = 0; k < target; k++) {
			players[pi].hand.push(deck.pop());
		}
	}

	const currentTurnIndex = 0; // host first
	const game = {
		status: 'playing',
		players,
		deck,
		discardPile,
		melds: [],
		currentTurnIndex,
		currentPlayerId: players[currentTurnIndex].id,
		// Host starts and cannot draw; must discard first → mark as if drawn to enable discard button
		hasDrawn: true,
		phase: 'action', // allow action/layoff/meld/discard; draw is disabled by hasDrawn
	};
	roomState.status = 'playing';
	roomState.game = game;
	return roomState;
}

function getCurrentPlayer(gs) {
	return gs.players[gs.currentTurnIndex];
}

function ensureTurn(gs, playerId) {
	const cp = getCurrentPlayer(gs);
	if (!cp || cp.id !== playerId) throw new Error('NOT_YOUR_TURN');
}

function getPlayerMeldPoints(gs, playerId) {
	let total = 0;
	for (const m of gs.melds) {
		if (m.ownerId !== playerId) continue;
		for (const c of m.cards) {
			const v = RANK_VALUE[c.rank];
			if (typeof v === 'number') total += v;
		}
	}
	return total;
}

function getPlayerMeldCount(gs, playerId) {
	return gs.melds.filter((m) => m.ownerId === playerId).length;
}

function draw(gs, playerId, source) {
	ensureTurn(gs, playerId);
	if (gs.phase !== 'draw') throw new Error('INVALID_PHASE');
	const player = getCurrentPlayer(gs);
	if (source === 'discard') {
		const points = getPlayerMeldPoints(gs, playerId);
		const melds = getPlayerMeldCount(gs, playerId);
		if (points < 41 && melds < 3) throw new Error('NEED_41_OR_3_MELDS');
		if (!gs.discardPile.length) throw new Error('DISCARD_EMPTY');
		player.hand.push(gs.discardPile.shift());
	} else {
		if (!gs.deck.length) throw new Error('DECK_EMPTY');
		player.hand.push(gs.deck.pop());
	}
	gs.phase = 'action';
	gs.hasDrawn = true;
}

function orderByRank(cards) {
	return cards
		.slice()
		.sort((a, b) => {
			const va = RANK_ORDER[a.rank] ?? Number.POSITIVE_INFINITY;
			const vb = RANK_ORDER[b.rank] ?? Number.POSITIVE_INFINITY;
			return va - vb;
		});
}

function isValidSet(cards) {
	if (cards.length < 3) return false;
	const wildCount = cards.filter((c) => c.suit === 'false').length;
	const real = cards.filter((c) => c.suit !== 'false');
	if (real.length === 0) return false;
	const rank = real[0].rank;
	if (!real.every((c) => c.rank === rank)) return false;
	return real.length + wildCount >= 3;
}

function isValidRun(cards) {
	if (cards.length < 3) return false;
	const wildCount = cards.filter((c) => c.suit === 'false').length;
	const real = cards.filter((c) => c.suit !== 'false');
	if (real.length < 2) return false;
	// If no wildcards, enforce same suit; with wildcards, we allow suits to differ for the real cards case-by-case
	if (wildCount === 0) {
		const suit = real[0].suit;
		if (!real.every((c) => c.suit === suit)) return false;
	}
	const vals = real.map((c) => RANK_ORDER[c.rank]).sort((a, b) => a - b);
	// No duplicate real ranks
	for (let i = 1; i < vals.length; i++) if (vals[i] === vals[i - 1]) return false;
	let neededWild = 0;
	for (let i = 1; i < vals.length; i++) {
		const diff = vals[i] - vals[i - 1];
		if (diff < 1) return false;
		if (diff > 1) neededWild += (diff - 1);
	}
	// wildcards first fill internal gaps; any remaining may extend at either end
	return neededWild <= wildCount;
}

function takeCardsFromHand(player, cardIds) {
	const taken = [];
	for (const id of cardIds) {
		const idx = player.hand.findIndex((c) => c.id === id);
		if (idx === -1) throw new Error('CARD_NOT_IN_HAND');
		taken.push(player.hand.splice(idx, 1)[0]); 
	}
	return taken;
}

function meld(gs, playerId, meld) {
	ensureTurn(gs, playerId);
	if (gs.phase === 'draw') throw new Error('MUST_DRAW_FIRST');
	const player = getCurrentPlayer(gs);
	const cards = takeCardsFromHand(player, meld.cardIds);
	if (meld.kind === 'set' && !isValidSet(cards)) throw new Error('INVALID_SET');
	if (meld.kind === 'run' && !isValidRun(cards)) throw new Error('INVALID_RUN');
    const meldObj = { id: rid(8), kind: meld.kind, ownerId: player.id, cards: orderByRank(cards) };
	gs.melds.push(meldObj);
	if (player.hand.length === 0) {
		gs.status = 'finished';
		gs.winnerId = player.id;
	}
}

function layoff(gs, playerId, layoff) {
	ensureTurn(gs, playerId);
	if (gs.phase === 'draw') throw new Error('MUST_DRAW_FIRST');
	const target = gs.melds.find((m) => m.id === layoff.meldId);
	if (!target) throw new Error('MELD_NOT_FOUND');
	if (target.cards.length !== 3) throw new Error('LAYOFF_ONLY_ON_THREE');
	const player = getCurrentPlayer(gs);
	const cards = takeCardsFromHand(player, layoff.cardIds);
	if (target.kind === 'set') {
		const combined = [...target.cards, ...cards];
		if (!isValidSet(combined)) throw new Error('INVALID_LAYOFF');
		target.cards = combined;
	} else {
		// run: must remain a straight of same suit
		const all = orderByRank([...target.cards, ...cards]);
		if (!isValidRun(all)) throw new Error('INVALID_LAYOFF');
		target.cards = all;
	}
	if (player.hand.length === 0) {
		gs.status = 'finished';
		gs.winnerId = player.id;
	}
}

function discard(gs, playerId, card) {
	ensureTurn(gs, playerId);
	if (gs.phase === 'draw' || !gs.hasDrawn) throw new Error('MUST_DRAW_FIRST');
	const player = getCurrentPlayer(gs);
	const idx = player.hand.findIndex((c) => c.id === card.id);
	if (idx === -1) throw new Error('CARD_NOT_IN_HAND');
	const [played] = player.hand.splice(idx, 1);
	gs.discardPile.unshift(played);
	// next turn
	if (player.hand.length === 0) {
		gs.status = 'finished';
		gs.winnerId = player.id;
	} else {
		gs.currentTurnIndex = (gs.currentTurnIndex + 1) % gs.players.length;
		gs.currentPlayerId = gs.players[gs.currentTurnIndex].id;
		gs.hasDrawn = false;
		gs.phase = 'draw';
	}
}

module.exports = {
	startGame,
	draw,
	meld,
	layoff,
	discard,
};


