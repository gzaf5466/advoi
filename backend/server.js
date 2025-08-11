const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

const db = require('./config/database');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const callRoutes = require('./routes/calls');
const uploadRoutes = require('./routes/uploads');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/admin', adminRoutes);

// Socket.IO authentication middleware (handshake)
const connectedUsers = new Map();
const activeCalls = new Map();

io.use((socket, next) => {
  try {
    const jwt = require('jsonwebtoken');
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Unauthorized'));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    return next();
  } catch (err) {
    return next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id, 'userId:', socket.userId);
  if (socket.userId) {
    connectedUsers.set(socket.userId, socket.id);
  }

  // Backward compatibility: accept authenticate event but it is no longer required
  socket.on('authenticate', (token) => {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      connectedUsers.set(decoded.userId, socket.id);
      socket.userId = decoded.userId;
      socket.emit('authenticated');
    } catch (error) {
      socket.emit('auth_error', 'Invalid token');
    }
  });

  // Join private room
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room: ${roomId}`);
  });

  // Leave room handler
  socket.on('leave_room', (roomId) => {
    try {
      socket.leave(roomId);
      console.log(`User ${socket.id} left room: ${roomId}`);
    } catch (e) {
      console.error('leave_room error:', e);
    }
  });

  // Send message
  socket.on('send_message', (data) => {
    socket.to(data.roomId).emit('receive_message', {
      ...data,
      timestamp: new Date(),
      userId: socket.userId
    });
  });

  // Typing indicators
  socket.on('typing', (data) => {
    socket.to(data.roomId).emit('user_typing', {
      userId: socket.userId,
      roomId: data.roomId
    });
  });

  socket.on('stop_typing', (data) => {
    socket.to(data.roomId).emit('user_stop_typing', {
      userId: socket.userId,
      roomId: data.roomId
    });
  });

  // Call handling
  socket.on('call_user', (data) => {
    const targetSocketId = connectedUsers.get(data.targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('incoming_call', {
        callerId: socket.userId,
        callerName: data.callerName,
        callType: data.callType
      });
    }
  });

  socket.on('call_accepted', (data) => {
    const callerSocketId = connectedUsers.get(data.callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call_accepted', {
        targetUserId: socket.userId
      });
    }
  });

  socket.on('call_rejected', (data) => {
    const callerSocketId = connectedUsers.get(data.callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call_rejected', {
        targetUserId: socket.userId
      });
    }
  });

  socket.on('call_ended', (data) => {
    const targetSocketId = connectedUsers.get(data.targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('call_ended', {
        userId: socket.userId
      });
    }
  });

  // WebRTC signaling
  socket.on('offer', (data) => {
    const targetSocketId = connectedUsers.get(data.targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('offer', {
        offer: data.offer,
        callerId: socket.userId
      });
    }
  });

  socket.on('answer', (data) => {
    const callerSocketId = connectedUsers.get(data.callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit('answer', {
        answer: data.answer,
        targetUserId: socket.userId
      });
    }
  });

  socket.on('ice_candidate', (data) => {
    const targetSocketId = connectedUsers.get(data.targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('ice_candidate', {
        candidate: data.candidate,
        userId: socket.userId
      });
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  });
}

module.exports = { app, io, server };