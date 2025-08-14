function createMemoryStore() {
	/** @type {Map<string, any>} */
	const rooms = new Map();
	return {
		get(roomId) {
			return rooms.get(roomId);
		},
		set(roomId, state) {
			rooms.set(roomId, state);
		},
		has(roomId) {
			return rooms.has(roomId);
		},
		delete(roomId) {
			rooms.delete(roomId);
		},
		list() {
			return Array.from(rooms.keys());
		},
	};
}

module.exports = { createMemoryStore };


