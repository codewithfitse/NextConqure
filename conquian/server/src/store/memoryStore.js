function createMemoryStore() {
	const rooms = new Map();
	return {
		get: (id) => rooms.get(id),
		set: (id, v) => rooms.set(id, v),
		has: (id) => rooms.has(id),
		delete: (id) => rooms.delete(id),
		list: () => Array.from(rooms.keys()),
	};
}

module.exports = { createMemoryStore };


