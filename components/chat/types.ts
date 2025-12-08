import type { User } from '@/stores/useAuthStore';

export interface ChatRoom {
  id: string;
  type: string;
  name: string;
  isPersonalSpace?: boolean;
  members: Array<{
    id: string;
    email: string;
    name: string | null;
    profileImageUrl: string | null;
  }>;
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
    user: {
      id: string;
      email: string;
      name: string | null;
    };
  } | null;
  updatedAt: string;
}

export interface Message {
  id: string;
  content: string;
  userId: string;
  chatRoomId: string;
  createdAt: string;
  updatedAt?: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    profileImageUrl: string | null;
    teamRole?: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
  };
}

export type { User };

