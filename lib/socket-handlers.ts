import { Socket, Server as SocketIOServer } from 'socket.io';
import { prisma } from './prisma';
import { verifyToken } from './auth';

// Extend Socket interface to include userId
interface AuthenticatedSocket extends Socket {
  userId?: string;
}

// Socket event handlers
export function setupSocketHandlers(socket: AuthenticatedSocket, io: SocketIOServer) {
  console.log('Setting up handlers for socket:', socket.id);

  // Authenticate socket connection
  socket.on('authenticate', async (data: { token: string }) => {
    console.log('[Socket] authenticate received for socket:', socket.id);
    try {
      const decoded = verifyToken(data.token);
      if (decoded) {
        socket.userId = decoded.userId;
        // Join user's personal room for notifications
        socket.join(decoded.userId);
        socket.emit('authenticated', { success: true });
        console.log(`[Socket] Socket ${socket.id} authenticated as user ${decoded.userId} and joined user room`);
      } else {
        console.error('[Socket] Authentication failed: Invalid token');
        socket.emit('authenticated', { success: false, error: 'Invalid token' });
      }
    } catch (error) {
      console.error('[Socket] Authentication error:', error);
      socket.emit('authenticated', { success: false, error: 'Authentication failed' });
    }
  });

  // Join chat room
  socket.on('joinRoom', async (data: { roomId: string }) => {
    if (!socket.userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const { roomId } = data;

    try {
      // Verify user is a member of the room
      const member = await prisma.chatRoomMember.findUnique({
        where: {
          userId_chatRoomId: {
            userId: socket.userId,
            chatRoomId: roomId,
          },
        },
      });

      if (!member) {
        socket.emit('error', { message: 'Not a member of this room' });
        return;
      }

      socket.join(roomId);
      console.log(`[Socket] Socket ${socket.id} joined room ${roomId}`);
      
      // Verify join was successful
      const roomAfterJoin = io.sockets.adapter.rooms.get(roomId);
      const usersInRoomAfterJoin = roomAfterJoin ? roomAfterJoin.size : 0;
      console.log(`[Socket] Room ${roomId} now has ${usersInRoomAfterJoin} users after join`);

      // Notify others in the room
      socket.to(roomId).emit('userJoined', {
        userId: socket.userId,
        roomId,
      });

      socket.emit('joinedRoom', { roomId });
    } catch (error) {
      console.error('Join room error:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Leave room
  socket.on('leaveRoom', (data: { roomId: string }) => {
    if (!socket.userId) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const { roomId } = data;
    socket.leave(roomId);
    console.log(`Socket ${socket.id} left room ${roomId}`);

    socket.to(roomId).emit('userLeft', {
      userId: socket.userId,
      roomId,
    });
  });

  // Send message
  socket.on('sendMessage', async (data: { roomId: string; content: string }) => {
    console.log('[Socket] sendMessage received:', { 
      socketId: socket.id, 
      userId: socket.userId,
      data 
    });

    if (!socket.userId) {
      console.error('[Socket] sendMessage failed: Not authenticated');
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const { roomId, content } = data;

    if (!content || content.trim().length === 0) {
      console.error('[Socket] sendMessage failed: Empty message');
      socket.emit('error', { message: 'Message cannot be empty' });
      return;
    }

    console.log('[Socket] Processing sendMessage:', { roomId, content, userId: socket.userId });

    try {
      // Verify user is a member of the room and check if it's a personal space
      const member = await prisma.chatRoomMember.findUnique({
        where: {
          userId_chatRoomId: {
            userId: socket.userId,
            chatRoomId: roomId,
          },
        },
        include: {
          chatRoom: {
            include: {
              members: true,
            },
          },
        },
      });

      if (!member) {
        socket.emit('error', { message: 'Not a member of this room' });
        return;
      }

      // Check if this is a personal space (only one member - the user themselves)
      const isPersonalSpace = member.chatRoom.type === 'DM' && member.chatRoom.members.length === 1;
      
      if (isPersonalSpace) {
        console.log('[Socket] Personal space detected, rejecting socket message (should use HTTP API)');
        socket.emit('error', { message: 'Personal space messages should be sent via HTTP API' });
        return;
      }

      // Check how many users are currently in the room (Socket.io room)
      const room = io.sockets.adapter.rooms.get(roomId);
      const usersInRoom = room ? room.size : 0;
      console.log(`[Socket] Users currently in room ${roomId}: ${usersInRoom}`);
      console.log(`[Socket] Room sockets:`, room ? Array.from(room) : []);
      console.log(`[Socket] Current socket ID: ${socket.id}, is in room: ${socket.rooms.has(roomId)}`);

      // Save message to database (always save to DB)
      console.log('[Socket] Saving message to database...');
      const message = await prisma.message.create({
        data: {
          content: content.trim(),
          userId: socket.userId,
          chatRoomId: roomId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              profileImageUrl: true,
            },
          },
        },
      });

      // Re-fetch user to ensure we have the latest profileImageUrl
      const user = await prisma.user.findUnique({
        where: { id: socket.userId },
        select: {
          id: true,
          email: true,
          name: true,
          profileImageUrl: true,
        },
      });

      // Use the re-fetched user data if available
      const messageUser = user || message.user;

      console.log('[Socket] Message saved:', { 
        messageId: message.id, 
        roomId: message.chatRoomId,
        userId: message.userId,
        userProfileImageUrl: messageUser.profileImageUrl,
        originalUserProfileImageUrl: message.user.profileImageUrl,
        user: messageUser,
      });

      // Check if this is a team channel and get the sender's team role
      const teamChannel = await prisma.teamChannel.findUnique({
        where: { chatRoomId: roomId },
        select: { teamId: true },
      });

      let userWithRole = messageUser;
      if (teamChannel) {
        const teamMember = await prisma.teamMember.findUnique({
          where: {
            userId_teamId: {
              userId: socket.userId,
              teamId: teamChannel.teamId,
            },
          },
          select: { role: true },
        });

        if (teamMember) {
          userWithRole = {
            ...messageUser,
            teamRole: teamMember.role,
          };
        }
      }

      // Update chat room's updatedAt
      await prisma.chatRoom.update({
        where: { id: roomId },
        data: { updatedAt: new Date() },
      });

      // Get all members of the room (from DB)
      const roomMembers = await prisma.chatRoomMember.findMany({
        where: { chatRoomId: roomId },
        select: { userId: true },
      });

      const memberUserIds = roomMembers.map((m: { userId: string }) => m.userId);
      console.log('[Socket] Room members (from DB):', memberUserIds);

      // If there are other users in the room (Socket.io room), broadcast real-time
      if (usersInRoom > 1) {
        // More than 1 user in room = real-time communication
        console.log('[Socket] Multiple users in room, broadcasting newMessage to room:', roomId);
        console.log('[Socket] Broadcasting to sockets:', room ? Array.from(room).filter(id => id !== socket.id) : []);
        
        // Broadcast to all users in the room except sender
        socket.to(roomId).emit('newMessage', {
          id: message.id,
          content: message.content,
          userId: message.userId,
          chatRoomId: message.chatRoomId,
          createdAt: message.createdAt,
          user: userWithRole,
        });
        
        console.log('[Socket] newMessage event emitted to room');
      } else {
        // Only 1 user in room = no real-time communication needed
        console.log('[Socket] Only one user in room, skipping real-time broadcast');
        console.log('[Socket] Room size:', usersInRoom, 'Room exists:', !!room);
      }

      // Also send messageSent event to sender with role info
      socket.emit('messageSent', {
        id: message.id,
        content: message.content,
        userId: message.userId,
        chatRoomId: message.chatRoomId,
        createdAt: message.createdAt,
        user: userWithRole,
      });

      // Send roomMessageUpdate to all room members (for updating room list)
      // This ensures that even if a user is not currently in the room, they get notified
      console.log('[Socket] Creating roomMessageUpdate with user profile:', {
        userId: messageUser.id,
        profileImageUrl: messageUser.profileImageUrl,
        user: messageUser,
      });
      
      const roomMessageUpdate = {
        roomId: message.chatRoomId,
        lastMessage: {
          id: message.id,
          content: message.content,
          createdAt: message.createdAt.toISOString(),
          user: {
            id: messageUser.id,
            email: messageUser.email,
            name: messageUser.name,
            profileImageUrl: messageUser.profileImageUrl ?? null,
          },
        },
        updatedAt: new Date().toISOString(),
      };
      
      console.log('[Socket] roomMessageUpdate created with profileImageUrl:', {
        userId: messageUser.id,
        profileImageUrl: roomMessageUpdate.lastMessage.user.profileImageUrl,
        originalProfileImageUrl: messageUser.profileImageUrl,
      });

      // Send roomMessageUpdate to all room members (except sender)
      // This ensures all members get notified regardless of which room they're currently viewing
      io.sockets.sockets.forEach((connectedSocket) => {
        const authenticatedSocket = connectedSocket as AuthenticatedSocket;
        if (authenticatedSocket.userId && memberUserIds.includes(authenticatedSocket.userId)) {
          if (authenticatedSocket.id !== socket.id) {
            // Send roomMessageUpdate to all members (they will handle notification logic on client side)
            // This works for users on main page, other pages, or viewing different rooms
            console.log(`[Socket] Sending roomMessageUpdate to user ${authenticatedSocket.userId} (socket ${authenticatedSocket.id})`);
            connectedSocket.emit('roomMessageUpdate', roomMessageUpdate);
          }
        }
      });

      // Also emit to sender for confirmation
      console.log('[Socket] Sending messageSent confirmation to sender');
      socket.emit('messageSent', {
        id: message.id,
        content: message.content,
        userId: message.userId,
        chatRoomId: message.chatRoomId,
        createdAt: message.createdAt,
        user: messageUser,
      });
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Socket ${socket.id} disconnected`);
  });
}

