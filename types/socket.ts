// Socket.IO event types
export interface ServerToClientEvents {
  // Define your server-to-client events here
  message: (data: { message: string; timestamp: Date }) => void;
  userJoined: (data: { userId: string; username: string }) => void;
  userLeft: (data: { userId: string }) => void;
}

export interface ClientToServerEvents {
  // Define your client-to-server events here
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (data: { roomId: string; message: string }) => void;
}

// export interface InterServerEvents {
//   // Define inter-server events here (for scaling)
// }

export interface SocketData {
  // Define socket data types here
  userId?: string;
  username?: string;
}

