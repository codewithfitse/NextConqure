import { describe, it, expect } from 'vitest';

const order = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, J: 10, Q: 11, K: 12 };

describe('rank order', () => {
	it('maps properly', () => {
		expect(order.A).toBe(1);
		expect(order.K).toBe(12);
		expect(order['7']).toBe(7);
	});
});


