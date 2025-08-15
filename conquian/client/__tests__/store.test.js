import { describe, it, expect } from 'vitest';
import { inferMeldKind } from '../src/store/useGameStore';

const c = (id, rank, suit) => ({ id, rank, suit });

describe('inferMeldKind', () => {
	it('detects set', () => {
		expect(inferMeldKind([c('1','A','hearts'), c('2','A','clubs'), c('3','A','spades')])).toBe('set');
	});
	it('detects run', () => {
		expect(inferMeldKind([c('1','A','hearts'), c('2','2','hearts'), c('3','3','hearts')])).toBe('run');
	});
	it('rejects wrap run', () => {
		expect(inferMeldKind([c('1','Q','hearts'), c('2','K','hearts'), c('3','A','hearts')])).toBe(null);
	});
	it('needs >=3', () => {
		expect(inferMeldKind([c('1','A','hearts'), c('2','2','hearts')])).toBe(null);
	});
});


