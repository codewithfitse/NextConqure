const { rid } = require('../util/id');

/** @type {import('../types')} */

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];

const RANK_TO_VALUE = {
	A: 1,
	'2': 2,
	'3': 3,
	'4': 4,
	'5': 5,
	'6': 6,
	'7': 7,
	J: 10,
	Q: 11,
	K: 12,
};

function createDeck() {
	/** @type {import('../types').Card[]} */
	const deck = [];
	for (const suit of SUITS) {
		for (const rank of RANKS) {
			deck.push({ suit, rank, id: `${rank}-${suit}-${rid(6)}` });
		}
	}
	return deck; // 40 cards
}

function shuffle(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

function sortRunOrder(cards) {
	return [...cards].sort((a, b) => RANK_TO_VALUE[a.rank] - RANK_TO_VALUE[b.rank]);
}

module.exports = {
	SUITS,
	RANKS,
	RANK_TO_VALUE,
	createDeck,
	shuffle,
	sortRunOrder,
};


