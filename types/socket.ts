// Socket.IO event types
export interface ServerToClientEvents {
  authenticated: (data: { success: boolean; error?: string }) => void;
  joinedRoom: (data: { roomId: string }) => void;
  userJoined: (data: { userId: string; roomId: string }) => void;
  userLeft: (data: { userId: string; roomId: string }) => void;
  newMessage: (data: {
    id: string;
    content: string;
    userId: string;
    chatRoomId: string;
    createdAt: Date;
    user: {
      id: string;
      email: string;
      name: string | null;
      profileImageUrl: string | null;
    };
  }) => void;
  messageSent: (data: {
    id: string;
    content: string;
    userId: string;
    chatRoomId: string;
    createdAt: Date;
    user: {
      id: string;
      email: string;
      name: string | null;
      profileImageUrl: string | null;
    };
  }) => void;
  roomMessageUpdate: (data: {
    roomId: string;
    lastMessage: {
      id: string;
      content: string;
      createdAt: string;
      user: {
        id: string;
        email: string;
        name: string | null;
      };
    };
    updatedAt: string;
  }) => void;
  error: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  authenticate: (data: { token: string }) => void;
  joinRoom: (data: { roomId: string }) => void;
  leaveRoom: (data: { roomId: string }) => void;
  sendMessage: (data: { roomId: string; content: string }) => void;
}

export interface SocketData {
  userId?: string;
  username?: string;
}

