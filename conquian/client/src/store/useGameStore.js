import { create } from 'zustand';
import { ioClient } from '../lib/socket.js';

export const useGameStore = create((set, get) => ({
	socket: null,
	self: null,
	roomState: null,
	gameState: null,
	chat: [],
	selected: [],
	lastError: null,
	selectedMeldId: null,
	lastToast: null,

	connect: () => {
		const s = ioClient();
		set({ socket: s });
		s.on('room:state', (room) => {
			// Auto-rebind self from URL playerId on refresh so you don't become spectator
			const existingSelf = get().self;
			if (!existingSelf) {
				const pid = readPlayerIdFromUrl();
				if (pid && room?.players?.length) {
					const me = room.players.find((p) => p.id === pid);
					if (me) set({ self: { id: me.id, nickname: me.nickname } });
				}
			}
			set({ roomState: room });
		});
		s.on('game:state', (gs) => {
			// Also attempt rebind if needed using players in game state
			const existingSelf = get().self;
			if (!existingSelf) {
				const pid = readPlayerIdFromUrl();
				if (pid && gs?.players?.length) {
					const me = gs.players.find((p) => p.id === pid);
					if (me) set({ self: { id: me.id, nickname: me.nickname } });
				}
			}
			set({ gameState: gs, lastError: null });
		});
		s.on('game:invalid', (msg) => {
			console.warn('Invalid move:', msg);
			set({ lastError: msg?.reason || 'Invalid move' });
		});
		s.on('system:toast', (t) => set({ lastToast: { ...t, ts: Date.now() } }));
		s.on('chat:message', (m) => set({ chat: [...get().chat, m] }));
		s.on('connect', () => {
			const roomId = get().roomState?.roomId || readRoomIdFromUrl();
			const playerId = get().self?.id || readPlayerIdFromUrl();
			if (roomId) s.emit('room:sync', { roomId, playerId }, () => {});
			set({ chat: [...get().chat, { playerId: 'system', message: 'Reconnected — synced game state.', ts: Date.now() }] });
		});
	},

	createRoom: (nickname) => {
		const s = get().socket;
		s.emit('room:create', { nickname }, (res) => {
			if (res?.error) return;
			set({ self: { id: res.playerId, nickname } });
			writeUrlParams({ roomId: res.roomId, playerId: res.playerId });
		});
	},
	joinRoom: (roomId, nickname) => {
		const s = get().socket;
		s.emit('room:join', { roomId, nickname }, (res) => {
			if (res?.error) return;
			if (res?.playerId) {
				set({ self: { id: res.playerId, nickname } });
				writeUrlParams({ roomId: res.roomId, playerId: res.playerId });
			}
		});
	},
	startGame: (roomId) => {
		get().socket.emit('game:start', { roomId });
	},
	drawFrom: (source) => {
		const roomId = get().roomState?.roomId;
		get().socket.emit('game:draw', { roomId, source });
	},
	makeMeld: (cards) => {
		const roomId = get().roomState?.roomId;
		const kind = inferMeldKind(cards);
		if (!kind) {
			set({ lastError: 'Invalid meld selection. Select 3 in a row (same suit) or use one F card to bridge the gap.' });
			return;
		}
		get().socket.emit('game:meld', { roomId, meld: { kind, cardIds: cards.map((c) => c.id) } });
		set({ selected: [] });
	},
	makeLayoff: (cards) => {
		const roomId = get().roomState?.roomId;
		const gs = get().gameState;
		if (!gs || !gs.melds.length) return;
		const meldId = get().selectedMeldId;
		if (!meldId) {
			set({ lastError: 'Select a meld to lay off onto.' });
			return;
		}
		const target = gs.melds.find((m) => m.id === meldId);
		if (!target || target.cards.length !== 3) {
			set({ lastError: 'Layoff allowed only onto melds with exactly 3 cards.' });
			return;
		}
		get().socket.emit('game:layoff', { roomId, layoff: { meldId, cardIds: cards.map((c) => c.id) } });
		set({ selected: [] });
	},
	discardCard: (card) => {
		const roomId = get().roomState?.roomId;
		get().socket.emit('game:discard', { roomId, card });
		set({ selected: [] });
	},
	sendChat: (message) => {
		const roomId = get().roomState?.roomId;
		get().socket.emit('chat:send', { roomId, message });
	},
	selectCard: (card) => {
		const exists = get().selected.some((c) => c.id === card.id);
		set({ selected: exists ? get().selected.filter((c) => c.id !== card.id) : [...get().selected, card] });
	},
	clearSelection: () => set({ selected: [] }),
	selectMeld: (meldId) => set({ selectedMeldId: meldId }),
	// Convenience setters for UI components that expect these
	setRoomState: (room) => set({ roomState: room }),
	setGameState: (gs) => set({ gameState: gs }),
}));

function inferMeldKind(cards) {
	if (cards.length < 3) return null;
	const ranks = new Set(cards.map((c) => c.rank));
	if (ranks.size === 1) return 'set';
	const order = { A: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 11, Q: 12, K: 13 };
	// Special case: allow 3-card run with one 'false' wildcard bridging a single-rank gap regardless of suits
	if (cards.length === 3) {
		const wild = cards.filter((c) => c.suit === 'false');
		const real = cards.filter((c) => c.suit !== 'false');
		if (wild.length === 1 && real.length === 2) {
			const values = real.map((c) => order[c.rank]).sort((a, b) => a - b);
			if (values[1] - values[0] === 2) return 'run';
		}
	}
	// Special case: allow 4-card run with one 'false' wildcard completing a straight regardless of suits
	if (cards.length === 4) {
		const wild = cards.filter((c) => c.suit === 'false');
		const real = cards.filter((c) => c.suit !== 'false');
		if (wild.length === 1 && real.length === 3) {
			const vals = real.map((c) => order[c.rank]).sort((a, b) => a - b);
			const unique = new Set(vals);
			if (unique.size === 3) {
				const min = vals[0];
				const max = vals[2];
				if (max - min === 3) return 'run';
			}
		}
	}
	const suit = cards[0].suit;
	if (!cards.every((c) => c.suit === suit)) return null;
	const sorted = [...cards].sort((a, b) => order[a.rank] - order[b.rank]);
	for (let i = 1; i < sorted.length; i++) if (order[sorted[i].rank] - order[sorted[i - 1].rank] !== 1) return null;
	return 'run';
}

export { inferMeldKind };

function readRoomIdFromUrl() { 
	try {
		const u = new URL(window.location.href);
		return u.searchParams.get('roomId');
	} catch { return null; }
}

function readPlayerIdFromUrl() {
	try {
		const u = new URL(window.location.href);
		return u.searchParams.get('playerId');
	} catch { return null; }
}

function writeUrlParams({ roomId, playerId }) {
	try {
		const u = new URL(window.location.href);
		if (roomId) u.searchParams.set('roomId', roomId);
		if (playerId) u.searchParams.set('playerId', playerId);
		window.history.replaceState({}, '', u.toString());
	} catch {}
}


