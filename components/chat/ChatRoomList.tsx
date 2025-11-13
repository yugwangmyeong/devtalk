'use client';

import { PersonalSpaceItem } from './PersonalSpaceItem';
import { ChatRoomItem } from './ChatRoomItem';
import type { ChatRoom } from './types';
import type { User } from '@/stores/useAuthStore';

interface ChatRoomListProps {
  rooms: ChatRoom[];
  selectedRoom: ChatRoom | null;
  user: User | null;
  isLoading: boolean;
  onSelectRoom: (room: ChatRoom) => void;
}

export function ChatRoomList({
  rooms,
  selectedRoom,
  user,
  isLoading,
  onSelectRoom,
}: ChatRoomListProps) {
  // 개인 공간이 아니고 DM 타입인 채팅방만 필터링 (GROUP, TEAM_CHANNEL 등 제외)
  const otherRooms = rooms.filter((room) => 
    !room.isPersonalSpace && 
    room.type === 'DM'
  );

  console.log('[ChatRoomList] Render:', {
    totalRooms: rooms.length,
    otherRooms: otherRooms.length,
    isLoading,
    roomIds: otherRooms.map(r => r.id),
    roomNames: otherRooms.map(r => r.name),
  });

  return (
    <>
      {/* Personal Space - Always shown */}
      <PersonalSpaceItem selectedRoom={selectedRoom} onSelect={onSelectRoom} rooms={rooms} />

      {/* Divider */}
      <div className="chat-divider"></div>

      {/* Chat Rooms List */}
      {isLoading ? (
        <div className="chat-loading">로딩 중...</div>
      ) : (
        <>
          {otherRooms.length > 0 ? (
            otherRooms.map((room) => (
              <ChatRoomItem
                key={room.id}
                room={room}
                user={user}
                isSelected={selectedRoom?.id === room.id}
                onSelect={onSelectRoom}
              />
            ))
          ) : (
            <div className="chat-empty-rooms">
              <p>채팅방이 없습니다</p>
            </div>
          )}
        </>
      )}
    </>
  );
}

