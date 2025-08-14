const { rid } = require('../util/id');
const { startGame, draw, meld, layoff, discard } = require('../engine/game');

function createHandlers(io, store) {
	io.on('connection', (socket) => {
		let currentRoomId = null;
		let currentPlayerId = null;

		function emitRoomState(room) {
			io.to(`room:${room.roomId}`).emit('room:state', {
				players: room.players.map(({ hand, ...p }) => p),
				hostId: room.players.find((p) => p.isHost)?.id || null,
				roomId: room.roomId,
				status: room.status,
			});
		}

		function emitGameState(state) {
			io.to(`room:${state.roomId}`).emit('game:state', state);
		}

		socket.on('room:create', ({ nickname }, cb) => {
			const roomId = rid(6);
			currentRoomId = roomId;
			currentPlayerId = rid(6);
			const room = {
				roomId,
				status: 'lobby',
				players: [
					{ id: currentPlayerId, nickname, hand: [], connected: true, isHost: true },
				],
			};
			store.set(roomId, room);
			socket.join(`room:${roomId}`);
			emitRoomState(room);
			cb?.({ roomId, playerId: currentPlayerId });
		});

		socket.on('room:join', ({ roomId, nickname }, cb) => {
			const room = store.get(roomId);
			if (!room) return cb?.({ error: 'room not found' });
			if (room.players.length >= 2) {
				// allow spectators
				socket.join(`room:${roomId}`);
				currentRoomId = roomId;
				return cb?.({ roomId, playerId: null, spectator: true });
			}
			currentRoomId = roomId;
			currentPlayerId = rid(6);
			room.players.push({ id: currentPlayerId, nickname, hand: [], connected: true, isHost: false });
			socket.join(`room:${roomId}`);
			store.set(roomId, room);
			emitRoomState(room);
			cb?.({ roomId, playerId: currentPlayerId });
		});

		socket.on('game:start', ({ roomId }) => {
			const room = store.get(roomId);
			if (!room) return;
			if (room.status !== 'lobby') return;
			if (room.players.length < 2) return;
			const state = startGame(roomId, room.players);
			store.set(roomId, state);
			emitRoomState(state);
			emitGameState(state);
		});

		socket.on('game:draw', ({ roomId, source }) => {
			try {
				const state = store.get(roomId);
				if (!state) return;
				const newState = draw(state, currentPlayerId, source);
				store.set(roomId, newState);
				emitGameState(newState);
			} catch (err) {
				io.to(socket.id).emit('game:invalid', { reason: err.message });
			}
		});

		socket.on('game:meld', ({ roomId, meld: payload }) => {
			try {
				const state = store.get(roomId);
				if (!state) return;
				const newState = meld(state, currentPlayerId, payload);
				store.set(roomId, newState);
				emitGameState(newState);
			} catch (err) {
				io.to(socket.id).emit('game:invalid', { reason: err.message });
			}
		});

		socket.on('game:layoff', ({ roomId, layoff: payload }) => {
			try {
				const state = store.get(roomId);
				if (!state) return;
				const newState = layoff(state, currentPlayerId, payload);
				store.set(roomId, newState);
				emitGameState(newState);
			} catch (err) {
				io.to(socket.id).emit('game:invalid', { reason: err.message });
			}
		});

		socket.on('game:discard', ({ roomId, card }) => {
			try {
				const state = store.get(roomId);
				if (!state) return;
				const newState = discard(state, currentPlayerId, card);
				store.set(roomId, newState);
				emitGameState(newState);
				if (newState.status === 'finished') {
					io.to(`room:${roomId}`).emit('system:toast', { kind: 'success', message: 'Game over' });
				}
			} catch (err) {
				io.to(socket.id).emit('game:invalid', { reason: err.message });
			}
		});

		// Player forfeits: opponent wins immediately
		socket.on('game:forfeit', ({ roomId }) => {
			const state = store.get(roomId);
			if (!state || !state.players) return;
			if (state.status !== 'active') return;
			const leaverId = currentPlayerId;
			const opponent = state.players.find((p) => p.id !== leaverId);
			if (!opponent) return;
			state.status = 'finished';
			state.winnerId = opponent.id;
			state.lastAction = 'forfeit';
			store.set(roomId, state);
			emitGameState(state);
			io.to(`room:${roomId}`).emit('system:toast', { kind: 'success', message: `${opponent.nickname} wins (opponent forfeited)` });
		});

		// Return to lobby after game finished
		socket.on('room:toLobby', ({ roomId }) => {
			const state = store.get(roomId);
			if (!state || !state.players) return;
			// Build a fresh lobby state with same players
			const lobby = {
				roomId: state.roomId,
				status: 'lobby',
				players: state.players.map((p) => ({ ...p, hand: [] })),
			};
			store.set(roomId, lobby);
			emitRoomState(lobby);
			io.to(`room:${roomId}`).emit('system:toast', { kind: 'info', message: 'Returned to lobby' });
		});

		socket.on('chat:send', ({ roomId, message }) => {
			io.to(`room:${roomId}`).emit('chat:message', { playerId: currentPlayerId, message, ts: Date.now() });
		});

		socket.on('disconnect', () => {
			if (!currentRoomId || !currentPlayerId) return;
			const state = store.get(currentRoomId);
			if (!state || !state.players) return;
			const player = state.players.find((p) => p.id === currentPlayerId);
			if (player) {
				player.connected = false;
				store.set(currentRoomId, state);
				emitRoomState(state);
			}
		});

		// Reconnection support: ask for sync; optionally resume a playerId
		socket.on('room:sync', ({ roomId, playerId }, cb) => {
			const state = store.get(roomId);
			if (!state) return cb?.({ error: 'room not found' });
			currentRoomId = roomId;
			if (playerId) {
				const p = state.players?.find((pl) => pl.id === playerId);
				if (p) {
					currentPlayerId = playerId;
					p.connected = true;
					store.set(roomId, state);
				}
			}
			socket.join(`room:${roomId}`);
			if (state.status === 'active' || state.status === 'finished') {
				io.to(socket.id).emit('game:state', state);
			}
			io.to(socket.id).emit('room:state', {
				players: state.players.map(({ hand, ...p }) => p),
				hostId: state.players.find((p) => p.isHost)?.id || null,
				roomId: state.roomId,
				status: state.status,
			});
			cb?.({ ok: true });
		});
	});
}

module.exports = { createHandlers };


