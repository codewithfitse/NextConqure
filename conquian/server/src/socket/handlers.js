const { rid } = require('../util/id');
const Game = require('../engine/game');

function sanitizeRoomState(state) {
	const host = state.players.find((p) => p.isHost);
	return {
		roomId: state.roomId,
		status: state.status,
		players: state.players.map(({ hand, ...p }) => p),
		hostId: host ? host.id : null,
	};
}

function createHandlers(io, store) {
	io.on('connection', (socket) => {
		// Create room
		socket.on('room:create', ({ nickname }, cb) => {
			let roomId;
			do { roomId = rid(6); } while (store.has(roomId));
			const state = {
				roomId,
				status: 'lobby',
				players: [
					{ id: socket.id, nickname: nickname || 'Player', hand: [], connected: true, isHost: true },
				],
			};
			store.set(roomId, state);
			socket.join(`room:${roomId}`);
			io.to(`room:${roomId}`).emit('room:state', sanitizeRoomState(state));
			cb?.({ roomId, playerId: socket.id });
		});

		// Join room
		socket.on('room:join', ({ roomId, nickname }, cb) => {
			const state = store.get(roomId);
			if (!state) return cb?.({ error: 'ROOM_NOT_FOUND' });
			const existing = state.players.find((p) => p.id === socket.id);
			if (!existing) {
				state.players.push({ id: socket.id, nickname: nickname || 'Player', hand: [], connected: true, isHost: false });
			} else {
				existing.connected = true;
				existing.nickname = existing.nickname || nickname || 'Player';
			}
			store.set(roomId, state);
			socket.join(`room:${roomId}`);
			io.to(`room:${roomId}`).emit('room:state', sanitizeRoomState(state));
			cb?.({ roomId, playerId: socket.id });
		});

		// Sync to an existing room on reconnect or refresh
		socket.on('room:sync', ({ roomId, playerId }, cb) => {
			const state = store.get(roomId);
			if (!state) return cb?.({ error: 'ROOM_NOT_FOUND' });
			if (playerId) {
				const player = state.players.find((p) => p.id === playerId) || state.players.find((p) => p.id === socket.id);
				if (player) {
					player.id = socket.id; // rebind to current socket
					player.connected = true;
				}
			}
			socket.join(`room:${roomId}`);
			socket.emit('room:state', sanitizeRoomState(state));
			if (state.game) socket.emit('game:state', state.game);
			cb?.({ ok: true });
		});

		// Start game
		socket.on('game:start', ({ roomId }, cb) => {
			const state = store.get(roomId);
			if (!state) return cb?.({ error: 'ROOM_NOT_FOUND' });
			const host = state.players.find((p) => p.isHost);
			if (!host || host.id !== socket.id) return cb?.({ error: 'NOT_HOST' });
			try {
				Game.startGame(state);
				store.set(roomId, state);
				io.to(`room:${roomId}`).emit('room:state', sanitizeRoomState(state));
				io.to(`room:${roomId}`).emit('game:state', state.game);
				cb?.({ ok: true });
			} catch (e) {
				cb?.({ error: e.message || 'START_FAILED' });
			}
		});

		// Player actions
		socket.on('game:draw', ({ roomId, source }) => {
			const state = store.get(roomId);
			if (!state || !state.game) return;
			try {
				Game.draw(state.game, socket.id, source);
				store.set(roomId, state);
				io.to(`room:${roomId}`).emit('game:state', state.game);
			} catch (e) {
				socket.emit('game:invalid', { reason: e.message });
			}
		});

		socket.on('game:meld', ({ roomId, meld }) => {
			const state = store.get(roomId);
			if (!state || !state.game) return;
			try {
				Game.meld(state.game, socket.id, meld);
				store.set(roomId, state);
				io.to(`room:${roomId}`).emit('game:state', state.game);
			} catch (e) {
				socket.emit('game:invalid', { reason: e.message });
			}
		});

		socket.on('game:layoff', ({ roomId, layoff }) => {
			const state = store.get(roomId);
			if (!state || !state.game) return;
			try {
				Game.layoff(state.game, socket.id, layoff);
				store.set(roomId, state);
				io.to(`room:${roomId}`).emit('game:state', state.game);
			} catch (e) {
				socket.emit('game:invalid', { reason: e.message });
			}
		});

		socket.on('game:discard', ({ roomId, card }) => {
			const state = store.get(roomId);
			if (!state || !state.game) return;
			try {
				Game.discard(state.game, socket.id, card);
				store.set(roomId, state);
				io.to(`room:${roomId}`).emit('game:state', state.game);
			} catch (e) {
				socket.emit('game:invalid', { reason: e.message });
			}
		});

		// Simple room chat passthrough
		socket.on('chat:send', ({ roomId, message }) => {
			if (!roomId || !message) return;
			io.to(`room:${roomId}`).emit('chat:message', { playerId: socket.id, message, ts: Date.now() });
		});

		socket.on('disconnect', () => {
			for (const roomId of store.list()) {
				const state = store.get(roomId);
				if (!state) continue;
				const player = state.players.find((p) => p.id === socket.id);
				if (player) {
					player.connected = false;
					store.set(roomId, state);
					io.to(`room:${roomId}`).emit('room:state', sanitizeRoomState(state));
				}
			}
		});
	});
}

module.exports = { createHandlers };


 