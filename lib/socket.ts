import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import type { Server as HTTPSServer } from 'https';
import { setupSocketHandlers } from './socket-handlers';

// Use Node.js global object to share Socket.IO instance across modules
// This is necessary because Next.js API routes run in separate module contexts
declare global {
  var io: SocketIOServer | undefined;
}

let globalIO: SocketIOServer | null = null;

export function initializeSocket(server: HTTPServer | HTTPSServer) {
  const allowedOrigins: string[] = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SOCKET_URL,
    'http://localhost:3000',
    'http://15.165.117.114:3000',
  ].filter((origin): origin is string => typeof origin === 'string' && origin.length > 0);

  const io = new SocketIOServer(server, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: allowedOrigins.length > 0 ? allowedOrigins : true, // 모든 origin 허용 (개발용)
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

  // Store in both module-level variable and global object
  globalIO = io;
  global.io = io;
  console.log('[Socket] Socket.IO initialized, globalIO set:', !!globalIO, 'global.io:', !!global.io);
  return io;
}

export function getIO(): SocketIOServer | null {
  // Try to get from global first (for API routes), then fall back to module variable
  const io = global.io || globalIO;
  console.log('[Socket] getIO() called, global.io:', !!global.io, 'globalIO:', !!globalIO, 'result:', !!io);
  return io || null;
}

export type SocketIOServerType = ReturnType<typeof initializeSocket>;

