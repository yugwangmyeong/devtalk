export type NotificationType = 'chat_invite' | 'message' | 'room_created' | 'user_joined' | 'team_invite';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  roomId?: string;
  roomName?: string; // 채팅방/채널 이름
  userId?: string;
  teamId?: string;
  teamName?: string; // 워크스페이스 이름
  createdAt: string;
  read: boolean;
  user?: {
    id: string;
    email: string;
    name: string | null;
    profileImageUrl: string | null;
  };
}

