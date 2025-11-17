export type NotificationType = 'chat_invite' | 'message' | 'room_created' | 'user_joined' | 'team_invite';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  roomId?: string;
  userId?: string;
  teamId?: string;
  teamName?: string;
  createdAt: string;
  read: boolean;
  user?: {
    id: string;
    email: string;
    name: string | null;
    profileImageUrl: string | null;
  };
}

