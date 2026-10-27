/**
 * Wapper Real-Time Node.js Express + Socket.io Server (server.js)
 * Maps real-time rooms to Wapper channels and coordinates browser-to-browser
 * WebRTC signaling ('webrtc-offer', 'webrtc-answer', 'ice-candidate').
 */
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

export function createWapperSignalingServer(existingApp = express()) {
  const httpServer = http.createServer(existingApp);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  const voiceChannelPeers = new Map();

  io.on('connection', (socket) => {
    socket.on('join-channel', ({ channelId, userId }) => {
      if (!channelId) return;
      socket.join(channelId);
      socket.to(channelId).emit('user-joined-channel', { channelId, userId, socketId: socket.id });
    });

    socket.on('send-message', (message) => {
      if (!message || !message.channelId) return;
      io.to(message.channelId).emit('new-message', {
        ...message,
        createdAt: message.createdAt || new Date().toISOString(),
      });
    });

    socket.on('typing-signal', ({ channelId, userId, username, isTyping }) => {
      if (!channelId) return;
      socket.to(channelId).emit('typing-signal', { channelId, userId, username, isTyping });
    });

    socket.on('webrtc-offer', ({ targetSocketId, sdp, channelId, fromUser }) => {
      if (!targetSocketId || !sdp) return;
      io.to(targetSocketId).emit('webrtc-offer', {
        fromSocketId: socket.id,
        sdp,
        channelId,
        fromUser,
      });
    });

    socket.on('webrtc-answer', ({ targetSocketId, sdp, channelId }) => {
      if (!targetSocketId || !sdp) return;
      io.to(targetSocketId).emit('webrtc-answer', {
        fromSocketId: socket.id,
        sdp,
        channelId,
      });
    });

    socket.on('ice-candidate', ({ targetSocketId, candidate, channelId }) => {
      if (!targetSocketId || !candidate) return;
      io.to(targetSocketId).emit('ice-candidate', {
        fromSocketId: socket.id,
        candidate,
        channelId,
      });
    });

    socket.on('disconnect', () => {
      voiceChannelPeers.forEach((peersSet, channelId) => {
        if (peersSet.has(socket.id)) {
          peersSet.delete(socket.id);
          socket.to(channelId).emit('voice-peer-left', { socketId: socket.id, channelId });
        }
      });
    });
  });

  return { app: existingApp, httpServer, io };
}

// If executed directly as an entrypoint in production, launch the full Wapper server
import('./server.ts').catch((err) => {
  console.error('[Wapper server.js] Failed to launch server.ts:', err);
  process.exit(1);
});

