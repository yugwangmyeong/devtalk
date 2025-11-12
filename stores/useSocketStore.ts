import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@/types/socket';

interface SocketState {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  connect: (token: string) => void;
  disconnect: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  isAuthenticated: false,
  connect: (token: string) => {
    const { socket: existingSocket } = get();
    
    // 기존 Socket이 있으면 먼저 정리
    if (existingSocket) {
      console.log('[Socket Store] Disconnecting existing socket before creating new one');
      existingSocket.disconnect();
      existingSocket.removeAllListeners();
    }

    console.log('[Socket Store] Creating new socket connection...');
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
      path: '/api/socket',
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[Socket Client] Socket connected:', socket.id);
      set({ isConnected: true });
      
      // Authenticate after connection
      console.log('[Socket Client] Authenticating with token...');
      socket.emit('authenticate', { token });
    });

    socket.on('authenticated', (data) => {
      if (data.success) {
        console.log('[Socket Client] Socket authenticated successfully');
        set({ isAuthenticated: true });
      } else {
        console.error('[Socket Client] Socket authentication failed:', data.error);
        set({ isAuthenticated: false });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket Client] Socket disconnected:', reason);
      set({ isConnected: false, isAuthenticated: false });
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket Client] Connection error:', error.message);
    });

    socket.on('error', (data) => {
      console.error('[Socket Client] Socket error:', data.message);
    });

    console.log('[Socket Store] Setting socket in store');
    set({ socket });
  },
  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false, isAuthenticated: false });
    }
  },
}));

