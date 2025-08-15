import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from './store/useGameStore.js';
import { ioClient } from './lib/socket.js';
import { FaRegPaperPlane, FaUserPlus, FaPlay, FaBolt, FaSync, FaBell } from 'react-icons/fa';

function TextInput({ value, onChange, placeholder }) {
	return (
		<input
			className="px-3 py-2 rounded bg-gray-800 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
			value={value}
			onChange={(e) => onChange(e.target.value)}
			placeholder={placeholder}
		/>
	);
}

function CardView({ card, small }) {
	const size = small ? 'w-[48px] h-[66px]' : 'w-[72px] h-[100px]';
	return (
		<div className={`bg-white text-gray-800 rounded-md shadow flex items-center justify-center border select-none ${size}`}>
			{card ? `${card.rank} ${symbol(card.suit)}` : ''}
		</div>
	);
}

function symbol(suit) {
	return { hearts: '❤️', diamonds: '♦', clubs: '♣', spades: '♠', false: 'F' }[suit] || '';
}

function toastColors(kind) {
	if (kind === 'success') return 'bg-emerald-900/40 border-emerald-700 text-emerald-200';
	if (kind === 'error') return 'bg-rose-900/40 border-rose-700 text-rose-200';
	return 'bg-gray-900/40 border-gray-700 text-gray-200';
}

function labelForOwner(gameState, ownerId) {
	const p = gameState.players.find((x) => x.id === ownerId);
	return p ? `${p.nickname}'s meld` : 'Meld';
}

export default function App() {
	const {
		socket,
		connect,
		roomState,
		gameState,
		setRoomState,
		setGameState,
		self,
		createRoom,
		joinRoom,
		startGame,
		drawFrom,
		makeMeld,
		makeLayoff,
		discardCard,
		sendChat,
		chat,
		selectCard,
		selected,
		clearSelection,
		lastError,
		lastToast,
	} = useGameStore();

	useEffect(() => {
		connect();
	}, [connect]);

	const isMyTurn = gameState && self && gameState.currentPlayerId === self.id;

	return (
		<div className="min-h-screen p-4 gap-4 flex flex-col">
			<header className="flex items-center justify-between">
				<div className="text-xl font-semibold">Conquian</div>
				<div className="text-sm text-gray-400">
					{roomState?.roomId ? `Room: ${roomState.roomId}` : 'No room'}
				</div>
			</header>

			{lastError && (
				<div className="p-2 rounded border border-rose-700 bg-rose-900/40 text-rose-200 text-sm">{lastError}</div>
			)}
            {lastToast && (
                <div className="fixed top-4 right-4 z-50">
                    <div className={`px-3 py-2 rounded shadow border ${toastColors(lastToast.kind)}`}>
                        <FaBell className="inline mr-2" />{lastToast.message}
                    </div>
                </div>
            )}
            {!gameState || roomState?.status === 'lobby' ? <Lobby /> : <GameTable />}
            {gameState?.status === 'finished' && <ResultModal />}

			<Chat />
		</div>
	);
}

function Lobby() {
	const { createRoom, joinRoom, roomState, self } = useGameStore();
	const [nickname, setNickname] = useState('');
	const [roomId, setRoomId] = useState('');

	return (
		<div className="flex flex-col gap-4 max-w-lg">
			<div className="flex gap-2">
				<TextInput value={nickname} onChange={setNickname} placeholder="Nickname" />
				<button className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-700"
					onClick={() => createRoom(nickname)}>
					<FaUserPlus className="inline mr-2" />Create Room
				</button>
			</div>
			<div className="flex gap-2">
				<TextInput value={roomId} onChange={setRoomId} placeholder="Room ID" />
				<button className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700"
					onClick={() => joinRoom(roomId, nickname)}>
					<FaBolt className="inline mr-2" />Join Room
				</button>
			</div>
			{roomState?.players?.length === 2 && roomState?.status === 'lobby' && roomState?.hostId === self?.id && (
				<button className="px-3 py-2 rounded bg-purple-600 hover:bg-purple-700 w-fit" onClick={() => useGameStore.getState().startGame(roomState.roomId)}>
					<FaPlay className="inline mr-2" />Start Game
				</button>
			)}
		</div>
	);
}


function GameTable() {
    const { gameState, self, drawFrom, makeMeld, makeLayoff, discardCard, selected, selectCard, clearSelection, selectMeld, selectedMeldId } = useGameStore();
	const me = self ? gameState.players.find((p) => p.id === self.id) : null;
	const finished = gameState.status === 'finished';
	const canAct = !finished && (self ? gameState.currentPlayerId === self.id : false);
    const hasDrawn = !!gameState?.hasDrawn;
	const topDiscard = gameState.discardPile[0] || null;
    const selectedMeld = selectedMeldId ? gameState.melds.find(m => m.id === selectedMeldId) : null;

	return (
		<div className="grid grid-cols-12 gap-4">
			<div className="col-span-9 flex flex-col gap-4">
                {finished && (
                    <div className="p-2 rounded bg-emerald-900/40 border border-emerald-700 text-emerald-200">
                        {gameState.winnerId === self?.id ? 'You won! 🎉' : `Winner: ${gameState.players.find(p=>p.id===gameState.winnerId)?.nickname || 'Player'}`}
                    </div>
                )}
				<div className="flex gap-4 items-center">
					<button className="px-3 py-2 rounded bg-sky-600 disabled:opacity-50" disabled={!canAct || hasDrawn} onClick={() => drawFrom('stock')}>Draw Stock</button>
					<button className="px-3 py-2 rounded bg-amber-600 disabled:opacity-50" disabled={!canAct || hasDrawn || !topDiscard} onClick={() => drawFrom('discard')}>Draw Discard</button>
					<button className="px-3 py-2 rounded bg-emerald-600 disabled:opacity-50" disabled={!canAct || !hasDrawn || selected.length < 3} onClick={() => makeMeld(selected)}>Meld</button>
                    <button className="px-3 py-2 rounded bg-teal-600 disabled:opacity-50" disabled={!canAct || !hasDrawn || selected.length < 1 || !(selectedMeld && selectedMeld.cards.length === 3)} onClick={() => makeLayoff(selected)}>Layoff</button>
					<button className="px-3 py-2 rounded bg-rose-600 disabled:opacity-50" disabled={!canAct || !hasDrawn || selected.length !== 1} onClick={() => discardCard(selected[0])}>Discard</button>
					<button className="px-3 py-2 rounded bg-gray-700" onClick={clearSelection}><FaSync className="inline" /></button>
				</div>
				<div className="flex items-center gap-6">
					<div className="flex flex-col items-center">
						<div className="text-xs text-gray-400">Stock</div>
						<div className="card bg-gray-700 text-gray-500">{gameState.deck.length}</div>
					</div>
					<div className="flex flex-col items-center">
						<div className="text-xs text-gray-400">Discard</div>
						<CardView card={topDiscard} />
					</div>
				</div>
				<div>
					<div className="text-sm text-gray-400 mb-2">Melds</div>
					<div className="flex flex-col gap-2">
						{gameState.melds.map((m) => (
							<div key={m.id} className="flex items-center gap-2">
								<button onClick={() => selectMeld(m.id)} className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600">Select</button>
								<div className="text-xs text-gray-400">{labelForOwner(gameState, m.ownerId)}</div>
								<div className={`flex gap-1 p-2 rounded border ${gameState.selectedMeldId===m.id ? 'bg-gray-700 border-emerald-600' : 'bg-gray-800 border-gray-700'}`}>
								<AnimatePresence initial={false}>
									{m.cards.map((c) => (
										<motion.div
											key={c.id}
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: -8 }}
											transition={{ duration: 0.15 }}
											className="bg-white text-gray-800 rounded-md shadow flex items-center justify-center border w-[48px] h-[66px] select-none"
										>
											{`${c.rank}${symbol(c.suit)}`}
										</motion.div>
									))}
								</AnimatePresence>
								</div>
							</div>
						))}
					</div>
				</div>
				<div>
					<div className="text-sm text-gray-400 mb-2">{me ? 'Your Hand' : 'Spectator'}</div>
					{me ? (
						<div className="flex gap-2 overflow-x-auto">
							{me.hand.map((c) => (
								<motion.button
									key={c.id}
									onClick={() => selectCard(c)}
									className={`bg-white text-gray-800 rounded-md shadow flex items-center justify-center border w-[72px] h-[100px] select-none ${selected.some((s) => s.id === c.id) ? 'ring-2 ring-emerald-500' : ''}`}
									whileTap={{ scale: 0.95 }}
									whileHover={{ y: -2 }}
								>
									{`${c.rank} ${symbol(c.suit)}`}
								</motion.button>
							))}
						</div>
					) : (
						<div className="text-gray-500">You joined as a spectator.</div>
					)}
				</div>
			</div>
			<div className="col-span-3">
				<Chat />
			</div>
		</div>
	);
}
function ResultModal() {
    const { gameState, self } = useGameStore();
    const iWon = gameState.winnerId === self?.id;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" />
            <div className={`relative z-10 w-full max-w-sm rounded-lg border shadow-xl p-6 ${iWon ? 'bg-emerald-900/40 border-emerald-700 text-emerald-100' : 'bg-rose-900/40 border-rose-700 text-rose-100'}`}>
                <div className="text-2xl font-bold mb-2">{iWon ? 'You Win!' : 'You Lose'}</div>
                <div className="text-sm opacity-90 mb-4">
                    {iWon ? 'Your hand reached zero cards.' : 'Opponent went out with zero cards.'}
                </div>
                <div className="text-sm">
                    Winner: {gameState.players.find(p => p.id === gameState.winnerId)?.nickname || 'Player'}
                </div>
            </div>
        </div>
    );
}


function Chat() {
	const { chat, sendChat } = useGameStore();
	const [msg, setMsg] = useState('');
	return (
		<div className="p-3 rounded bg-gray-800 border border-gray-700 flex flex-col gap-2 max-h-[40vh]">
			<div className="font-semibold">Chat</div>
			<div className="flex-1 overflow-y-auto text-sm space-y-1">
				{chat.map((m, i) => (
					<div key={i} className="text-gray-300">
						<span className="text-gray-400">[{new Date(m.ts).toLocaleTimeString()}]</span> {m.nickname ?? m.playerId}: {m.message}
					</div>
				))}
			</div>
			<div className="flex gap-2">
				<input className="flex-1 px-2 py-1 rounded bg-gray-900 border border-gray-700" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message" />
				<button className="px-3 py-2 rounded bg-emerald-600" onClick={() => { if (!msg.trim()) return; sendChat(msg.trim()); setMsg(''); }}>
					<FaRegPaperPlane />
				</button>
			</div>
		</div>
	);
}


