/**
 * CrapChat signaling server — Express + Socket.IO for WebRTC rooms.
 */
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 3000;
const MAX_ROOM_SIZE = 4;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

/** @type {Map<string, { id: string, peers: Map<string, { name: string, socketId: string }> }>} */
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { id: roomId, peers: new Map() });
  }
  return rooms.get(roomId);
}

function roomPublicState(room) {
  return {
    id: room.id,
    peers: [...room.peers.entries()].map(([peerId, p]) => ({
      peerId,
      name: p.name,
    })),
    count: room.peers.size,
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, name: 'CrapChat' });
});

app.post('/api/rooms', (_req, res) => {
  const id = uuidv4().slice(0, 8);
  getOrCreateRoom(id);
  res.json({ roomId: id, url: `/room/${id}` });
});

app.get('/api/rooms/:id', (req, res) => {
  const room = rooms.get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found (or empty)' });
  res.json(roomPublicState(room));
});

// SPA-ish: room links serve index
app.get('/room/:id', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

io.on('connection', (socket) => {
  let currentRoom = null;
  let peerId = null;

  socket.on('join', ({ roomId, name, peerId: requestedId }, ack) => {
    try {
      if (!roomId || typeof roomId !== 'string') {
        return ack?.({ error: 'Invalid room id' });
      }
      const room = getOrCreateRoom(roomId.trim().toLowerCase());
      if (room.peers.size >= MAX_ROOM_SIZE) {
        return ack?.({ error: `Room full (max ${MAX_ROOM_SIZE})` });
      }
      peerId = requestedId || uuidv4().slice(0, 8);
      const displayName = (name && String(name).slice(0, 32)) || `Sitter-${peerId.slice(0, 4)}`;

      room.peers.set(peerId, { name: displayName, socketId: socket.id });
      currentRoom = roomId.trim().toLowerCase();
      socket.join(currentRoom);

      const others = [...room.peers.entries()]
        .filter(([id]) => id !== peerId)
        .map(([id, p]) => ({ peerId: id, name: p.name }));

      socket.to(currentRoom).emit('peer-joined', { peerId, name: displayName });
      ack?.({ ok: true, peerId, name: displayName, peers: others, roomId: currentRoom });
    } catch (e) {
      ack?.({ error: e.message || 'Join failed' });
    }
  });

  socket.on('signal', ({ to, data }) => {
    if (!currentRoom || !peerId) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    const target = room.peers.get(to);
    if (!target) return;
    io.to(target.socketId).emit('signal', { from: peerId, data });
  });

  socket.on('reaction', ({ emoji }) => {
    if (!currentRoom || !peerId) return;
    socket.to(currentRoom).emit('reaction', { from: peerId, emoji });
  });

  socket.on('chat-toast', ({ message }) => {
    if (!currentRoom || !peerId) return;
    const room = rooms.get(currentRoom);
    const name = room?.peers.get(peerId)?.name || 'Someone';
    socket.to(currentRoom).emit('chat-toast', { from: peerId, name, message });
  });

  socket.on('leave', () => cleanup());
  socket.on('disconnect', () => cleanup());

  function cleanup() {
    if (!currentRoom || !peerId) return;
    const room = rooms.get(currentRoom);
    if (room) {
      room.peers.delete(peerId);
      socket.to(currentRoom).emit('peer-left', { peerId });
      if (room.peers.size === 0) rooms.delete(currentRoom);
    }
    socket.leave(currentRoom);
    currentRoom = null;
    peerId = null;
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚽 CrapChat signaling on http://0.0.0.0:${PORT}`);
});
