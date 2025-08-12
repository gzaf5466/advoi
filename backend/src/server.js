import express from 'express';
import http from 'http';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { ExpressPeerServer } from 'peer';
import { Server } from 'socket.io';
import { Pool } from 'pg';

import authRouter from './routes/auth.js';
import healthRouter from './routes/health.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

// Middleware
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// PostgreSQL connection (optional)
const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_SSL = (process.env.DATABASE_SSL || '').toLowerCase() === 'true';
let pgReady = false;
let pool = null;
if (DATABASE_URL) {
  pool = new Pool({ connectionString: DATABASE_URL, ssl: DATABASE_SSL ? { rejectUnauthorized: false } : undefined });
  (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          room_id TEXT NOT NULL,
          user_id TEXT,
          content TEXT NOT NULL,
          timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_messages_room_time ON messages (room_id, timestamp);
      `);
      pgReady = true;
      console.log('PostgreSQL connected and ensured messages table');
    } catch (err) {
      console.error('PostgreSQL init error:', err.message);
    }
  })();
}

// Simple in-memory message persistence (fallback if DB not configured)
const messagesByRoom = new Map(); // roomId -> [{ userId, text, timestamp }]

// Routes
app.use('/health', healthRouter);
app.use('/auth', authRouter);

// Message history APIs
app.get('/messages', async (req, res) => {
  const roomId = req.query.roomId;
  if (!roomId) return res.status(400).json({ error: 'roomId is required' });
  if (pgReady && pool) {
    try {
      const { rows } = await pool.query(
        'SELECT user_id, content, timestamp FROM messages WHERE room_id = $1 ORDER BY timestamp ASC',
        [roomId]
      );
      return res.json({ roomId, messages: rows.map(r => ({ userId: r.user_id, text: r.content, timestamp: r.timestamp })) });
    } catch (e) {
      console.error('DB fetch messages error:', e);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }
  const msgs = messagesByRoom.get(roomId) || [];
  res.json({ roomId, messages: msgs });
});

app.post('/messages', async (req, res) => {
  const { roomId, userId, text, timestamp } = req.body || {};
  if (!roomId || !text) return res.status(400).json({ error: 'roomId and text are required' });
  const entry = { roomId, userId: userId || null, text, timestamp: timestamp ? new Date(timestamp) : new Date() };
  if (pgReady && pool) {
    try {
      await pool.query(
        'INSERT INTO messages (room_id, user_id, content, timestamp) VALUES ($1, $2, $3, $4)',
        [entry.roomId, entry.userId, entry.text, entry.timestamp]
      );
      return res.status(201).json({ ok: true });
    } catch (e) {
      console.error('DB persist message error:', e);
      return res.status(500).json({ error: 'Failed to save message' });
    }
  }
  const arr = messagesByRoom.get(roomId) || [];
  arr.push({ userId: entry.userId, text: entry.text, timestamp: entry.timestamp.toISOString() });
  messagesByRoom.set(roomId, arr);
  res.status(201).json({ ok: true });
});

// PeerJS signaling server
const peerServer = ExpressPeerServer(server, {
  path: '/',
  proxied: true,
  debug: true,
});
app.use('/peerjs', peerServer);

peerServer.on('connection', (client) => {
  console.log('Peer connected:', client.getId());
});
peerServer.on('disconnect', (client) => {
  console.log('Peer disconnected:', client.getId());
});

const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    credentials: true,
  },
});

io.on('connection', (socket) => {
  // ... existing code ...

  // Messaging
  socket.on('send_message', async (data) => {
    // data: { roomId, text, meta? }
    const payload = {
      ...data,
      userId: socket.userId,
      timestamp: new Date().toISOString(),
    };

    // Persist to DB if available, else in memory
    if (pgReady && pool) {
      try {
        await pool.query(
          'INSERT INTO messages (room_id, user_id, content, timestamp) VALUES ($1, $2, $3, $4)',
          [data.roomId, payload.userId || null, payload.text, new Date(payload.timestamp)]
        );
      } catch (e) {
        console.error('DB persist message error:', e);
      }
    } else {
      try {
        const arr = messagesByRoom.get(data.roomId) || [];
        arr.push({ userId: payload.userId, text: payload.text, timestamp: payload.timestamp });
        messagesByRoom.set(data.roomId, arr);
      } catch (e) {
        console.error('Persist message error:', e);
      }
    }

    // Broadcast
    socket.to(data.roomId).emit('receive_message', payload);
  });

  // ... existing code ...
});

server.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
  console.log(`PeerJS signaling at /peerjs`);
});
