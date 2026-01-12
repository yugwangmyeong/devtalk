import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import type { Server as HTTPSServer } from 'https';
import { setupSocketHandlers } from './socket-handlers';

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
    
    setupSocketHandlers(socket, io);
  });

  io.on('connection_error', (error) => {
  
  });


  globalIO = io;
  global.io = io;
  return io;
}

export function getIO(): SocketIOServer | null {
  // Try to get from global first (for API routes), then fall back to module variable
  const io = global.io || globalIO;
  return io || null;
}

export type SocketIOServerType = ReturnType<typeof initializeSocket>;

