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
    
    if (existingSocket) {
     
      existingSocket.disconnect();
      existingSocket.removeAllListeners();
    }


    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 
                      process.env.NEXT_PUBLIC_APP_URL || 
                      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(socketUrl, {
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socket.on('connect', () => {
     
      set({ isConnected: true });
      
     
      socket.emit('authenticate', { token });
    });

    socket.on('authenticated', (data) => {
      if (data.success) {
        
        set({ isAuthenticated: true });
      } else {
        set({ isAuthenticated: false });
      }
    });

    socket.on('disconnect', (reason) => {
     
      set({ isConnected: false, isAuthenticated: false });
    });

    socket.on('connect_error', (error) => {
    });

    socket.on('error', (data) => {
     
    });

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

