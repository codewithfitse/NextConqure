Conquian (Monorepo)

JavaScript monorepo (no TypeScript, no shadcn) implementing a realtime two-player Conquian variant.

- Workspaces: `client/` (React + Vite) and `server/` (Node + Express + Socket.io)
- Styling: TailwindCSS + React Icons
- State: Zustand
- Tests: Vitest (client), Jest (server)

Setup

1) Install deps at the root:

```
npm i
```

2) Dev (launch client and server):

```
npm run dev
```

- Client: `http://localhost:5173`
- Server: `http://localhost:5174`

3) Build all:

```
npm run build
```

4) Test all:

```
npm test
```

Environment:
- client/.env: `VITE_SERVER_URL=http://localhost:5174`

Notes
- Server is authoritative; clients send intents.
- In-memory store; can be swapped for Redis later.

