const { isValidSet, isValidRun, canLayoff } = require('../src/engine/rules');
const { RANK_TO_VALUE } = require('../src/engine/cards');

function c(id, rank, suit) {
	return { id, rank, suit };
}

test('isValidSet: true for same rank >=3', () => {
	expect(isValidSet([c('1','A','hearts'), c('2','A','clubs'), c('3','A','spades')])).toBe(true);
});

test('isValidSet: false for mixed rank', () => {
	expect(isValidSet([c('1','A','hearts'), c('2','2','clubs'), c('3','A','spades')])).toBe(false);
});

test('isValidRun: true for same suit consecutive', () => {
	expect(isValidRun([c('1','A','hearts'), c('2','2','hearts'), c('3','3','hearts')])).toBe(true);
});

test('isValidRun: false for wrap', () => {
	expect(isValidRun([c('1','Q','hearts'), c('2','K','hearts'), c('3','A','hearts')])).toBe(false);
});

test('RANK_TO_VALUE mapping', () => {
	expect(RANK_TO_VALUE.A).toBe(1);
	expect(RANK_TO_VALUE.K).toBe(12);
});

test('canLayoff extends run at ends', () => {
	const meld = { id: 'm', kind: 'run', ownerId: 'p', cards: [c('1','2','hearts'), c('2','3','hearts'), c('3','4','hearts')] };
	expect(canLayoff(meld, [c('4','5','hearts')])).toBe(true);
	expect(canLayoff(meld, [c('0','A','hearts')])).toBe(true);
});


