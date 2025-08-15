import { describe, it, expect } from 'vitest';
import { inferMeldKind } from '../src/store/useGameStore';

const c = (id, rank, suit) => ({ id, rank, suit });

describe('inferMeldKind suit validation', () => {
	it('rejects run with mixed suits', () => {
		expect(inferMeldKind([c('1','A','hearts'), c('2','2','clubs'), c('3','3','hearts')])).toBe(null);
	});
});


