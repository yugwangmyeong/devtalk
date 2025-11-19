export type NotificationType = 'chat_invite' | 'message' | 'room_created' | 'user_joined' | 'team_invite' | 'friend_request';

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
  channelId?: string; // 워크스페이스 채널 ID
  friendshipId?: string; // 친구 요청 ID
  createdAt: string;
  read: boolean;
  user?: {
    id: string;
    email: string;
    name: string | null;
    profileImageUrl: string | null;
  };
}

