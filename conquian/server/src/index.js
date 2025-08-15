const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { createHandlers } = require('./socket/handlers');
const { createMemoryStore } = require('./store/memoryStore');

const PORT = process.env.PORT || 1234;

const app = express();
app.use(cors());
app.get('/health', (req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

const store = createMemoryStore();
createHandlers(io, store);

server.listen(PORT, () => {
	// eslint-disable-next-line no-console
	console.log(`Server listening on http://localhost:${PORT}`);
});


