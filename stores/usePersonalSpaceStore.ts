import { create } from 'zustand';
import type { ChatRoom } from '@/components/chat/types';

interface PersonalSpaceState {
  personalSpaceRoom: ChatRoom | null;
  setPersonalSpaceRoom: (room: ChatRoom | null) => void;
  fetchPersonalSpace: () => Promise<ChatRoom | null>;
}

export const usePersonalSpaceStore = create<PersonalSpaceState>((set, get) => ({
  personalSpaceRoom: null,
  
  setPersonalSpaceRoom: (room: ChatRoom | null) => {
    set({ personalSpaceRoom: room });
  },
  
  fetchPersonalSpace: async () => {
    // 이미 로드된 room이 있으면 반환
    const currentRoom = get().personalSpaceRoom;
    if (currentRoom) {
      return currentRoom;
    }
    
    // 없으면 API 호출
    try {
      const response = await fetch('/api/chat/personal-space');
      if (response.ok) {
        const data = await response.json();
        const room: ChatRoom = {
          id: data.room.id,
          name: data.room.name || '나만의 공간',
          type: 'DM',
          isPersonalSpace: true,
          members: data.room.members || [],
          lastMessage: data.room.lastMessage,
          updatedAt: data.room.updatedAt,
        };
        set({ personalSpaceRoom: room });
        return room;
      }
    } catch (error) {
      console.error('Failed to fetch personal space:', error);
    }
    return null;
  },
}));

