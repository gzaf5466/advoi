# Advocate AI Messaging App

This monorepo contains:
- Backend (Express + Socket.IO + PeerJS) with optional PostgreSQL persistence
- Client (React + Vite) with Advocate AI-themed chat UI
- Render Blueprint (render.yaml) to deploy both services on Render Free

## Folder Structure

```
.
├─ render.yaml                  # Render Blueprint to deploy backend + client
├─ LICENSE                      # MIT license
├─ .gitignore                   # Ignore builds, node_modules, env files, etc.
├─ backend/
│  ├─ package.json              # Node >=18, start/dev scripts
│  ├─ .env.example              # JWT_SECRET, CLIENT_ORIGIN, PORT, DATABASE_URL, DATABASE_SSL
│  └─ src/
│     ├─ server.js              # Express, Socket.IO, PeerJS, PostgreSQL (optional)
│     ├─ routes/
│     │  ├─ auth.js
│     │  └─ health.js           # /health endpoint (used by Render)
│     ├─ models/                # (optional for future)
│     └─ sockets/               # (optional for future)
└─ client/
   ├─ package.json              # Node >=18, Vite scripts
   ├─ .env.example              # VITE_SOCKET_URL
   ├─ index.html
   └─ src/
      ├─ main.jsx
      ├─ App.jsx
      ├─ Components/
      │  ├─ ChatWindow.jsx
      │  ├─ Sidebar.jsx
      │  ├─ FilterBar.jsx
      │  └─ Particlebackprofile.jsx
      ├─ pages/
      │  └─ Dashboard.jsx
      ├─ data/
      │  └─ lawyers.js
      ├─ hooks/
      │  └─ useIsMobile.js
      └─ assets/
```

Note: A legacy `mgz-secure/` folder may be present; it is not required for deployment. The app builds from `backend/` and `client/` only.

## Environment Variables

Backend (`backend/.env`):
- JWT_SECRET=change_me
- CLIENT_ORIGIN=http://localhost:5173 (or your Render client URL)
- PORT=5000 (Render will override)
- DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DBNAME (optional; enables DB persistence)
- DATABASE_SSL=true (if your provider requires SSL; Render/Neon/Supabase usually do)

Client (`client/.env`):
- VITE_SOCKET_URL=http://localhost:5000 (on Render this is auto-wired via render.yaml)

## Local Development

1) Backend
- cd backend
- npm install
- copy .env.example to .env and fill values
- npm run dev

2) Client
- cd client
- npm install
- copy .env.example to .env and fill values
- npm run dev

## Deploy to Render (Blueprint)

1) Push this repo to GitHub.
2) In Render: New → Blueprint → select your GitHub repo → Apply.
3) Render will create two services:
   - advocate-backend (Node web service; healthCheckPath: /health)
   - advocate-client (Static site built by Vite)
4) After first deploy, open advocate-backend → Environment → set DATABASE_URL to your PostgreSQL connection string (optional), and DATABASE_SSL=true if required. Redeploy.

The client’s `VITE_SOCKET_URL` is automatically sourced from the backend’s public URL via `fromService` in `render.yaml`.

## Tech
- Backend: Express, Socket.IO, PeerJS, JWT, optional PostgreSQL (pg)
- Frontend: React + Vite, socket.io-client

## License
MIT
