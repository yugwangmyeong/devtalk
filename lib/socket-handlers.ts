import { Socket } from 'socket.io';
import { prisma } from './prisma';
import { getRedisClient } from './redis';

// Socket event handlers
export function setupSocketHandlers(socket: Socket) {
  console.log('Setting up handlers for socket:', socket.id);

  // Example: Join room
  socket.on('joinRoom', async (roomId: string) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
    
    // Notify others in the room
    socket.to(roomId).emit('userJoined', {
      socketId: socket.id,
      roomId,
    });
  });

  // Example: Leave room
  socket.on('leaveRoom', (roomId: string) => {
    socket.leave(roomId);
    console.log(`Socket ${socket.id} left room ${roomId}`);
    
    socket.to(roomId).emit('userLeft', {
      socketId: socket.id,
      roomId,
    });
  });

  // Example: Send message
  socket.on('sendMessage', async (data: { roomId: string; message: string; userId?: string }) => {
    const { roomId, message, userId } = data;
    
    // Save to database if needed
    // const savedMessage = await prisma.message.create({ ... });
    
    // Broadcast to room
    socket.to(roomId).emit('message', {
      socketId: socket.id,
      roomId,
      message,
      userId,
      timestamp: new Date(),
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Socket ${socket.id} disconnected`);
  });
}

