const { RANK_TO_VALUE, sortRunOrder } = require('./cards');

function isValidSet(cards) {
	if (!cards || cards.length < 3) return false;
	const rank = cards[0].rank;
	if (!cards.every((c) => c.rank === rank)) return false;
	// Ensure unique card IDs (no duplicates)
	const ids = new Set(cards.map((c) => c.id));
	return ids.size === cards.length;
}

function isValidRun(cards) {
	if (!cards || cards.length < 3) return false;
	const suit = cards[0].suit;
	if (!cards.every((c) => c.suit === suit)) return false;
	const ordered = sortRunOrder(cards);
	for (let i = 1; i < ordered.length; i++) {
		const prev = ordered[i - 1];
		const curr = ordered[i];
		if (RANK_TO_VALUE[curr.rank] - RANK_TO_VALUE[prev.rank] !== 1) return false;
	}
	return true;
}

function canLayoff(existingMeld, cards) {
	if (existingMeld.kind === 'set') {
		// All same rank
		const rank = existingMeld.cards[0].rank;
		return cards.every((c) => c.rank === rank);
	}
	// run: can extend at ends only, while preserving order
	const combined = [...existingMeld.cards, ...cards];
	if (!isValidRun(combined)) return false;
	// Enforce that new cards extend ends, not insert gaps
	const orderedExisting = sortRunOrder(existingMeld.cards);
	const orderedCombined = sortRunOrder(combined);
	// existing should be a prefix of combined or suffix; practically, combined should start with <= existing.start and end with >= existing.end
	const existingStart = orderedExisting[0];
	const existingEnd = orderedExisting[orderedExisting.length - 1];
	const combinedStart = orderedCombined[0];
	const combinedEnd = orderedCombined[orderedCombined.length - 1];
	return (
		RANK_TO_VALUE[combinedStart.rank] <= RANK_TO_VALUE[existingStart.rank] &&
		RANK_TO_VALUE[combinedEnd.rank] >= RANK_TO_VALUE[existingEnd.rank]
	);
}

function canDiscard(player, card) {
	return player.hand.some((c) => c.id === card.id);
}

module.exports = {
	isValidSet,
	isValidRun,
	canLayoff,
	canDiscard,
};


