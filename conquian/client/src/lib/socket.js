import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:1234';

let socket = null;

export function ioClient() {
	if (!socket) {
		socket = io(URL, { autoConnect: true, reconnection: true });
	}
	return socket;
}


