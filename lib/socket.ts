import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import type { Server as HTTPSServer } from 'https';
import { setupSocketHandlers } from './socket-handlers';

export function initializeSocket(server: HTTPServer | HTTPSServer) {
  const io = new SocketIOServer(server, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    console.log('[Socket Server] Client connected:', socket.id);
    setupSocketHandlers(socket, io);
  });

  io.on('connection_error', (error) => {
    console.error('[Socket Server] Connection error:', error);
  });

  return io;
}

export type SocketIOServerType = ReturnType<typeof initializeSocket>;

