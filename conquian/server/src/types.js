// Shared-like types (JSDoc for clarity)

/** @typedef {'hearts'|'diamonds'|'clubs'|'spades'} Suit */
/** @typedef {'A'|'2'|'3'|'4'|'5'|'6'|'7'|'J'|'Q'|'K'} Rank */

/** @typedef {{ suit: Suit, rank: Rank, id: string }} Card */

/** @typedef {'set'|'run'} MeldKind */

/** @typedef {{ id: string, kind: MeldKind, cards: Card[], ownerId: string }} Meld */

/** @typedef {{ id: string, nickname: string, hand: Card[], connected: boolean, isHost: boolean }} PlayerState */

/** @typedef {{
 * roomId: string,
 * status: 'lobby'|'active'|'finished',
 * players: PlayerState[],
 * currentPlayerId: string|null,
 * winnerId: string|null,
 * deck: Card[],
 * discardPile: Card[],
 * melds: Meld[],
 * lastAction?: string,
 * }} GameState */

/** @typedef {{ kind: 'set'|'run', cardIds: string[] }} MeldPayload */
/** @typedef {{ meldId: string, cardIds: string[] }} LayoffPayload */

module.exports = {};


