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
  // 개인 공간 찾기 (rooms 배열에서)
  const personalSpaceRoom = rooms.find(r => r.isPersonalSpace);
  
  // 개인 공간이 아니고 DM 타입인 채팅방만 필터링 (GROUP, TEAM_CHANNEL 등 제외)
  // 중복 제거: 같은 ID를 가진 방이 여러 개 있으면 하나만 유지
  const uniqueRooms = rooms.reduce((acc: ChatRoom[], room: ChatRoom) => {
    const existingRoom = acc.find(r => r.id === room.id);
    if (!existingRoom) {
      acc.push(room);
    }
    return acc;
  }, []);

  // 개인 공간 ID를 제외하고 필터링
  const personalSpaceId = personalSpaceRoom?.id;
  const otherRooms = uniqueRooms.filter((room) => 
    !room.isPersonalSpace && 
    room.type === 'DM' &&
    room.id !== personalSpaceId // 개인 공간 ID도 명시적으로 제외
  );

  console.log('[ChatRoomList] Render:', {
    totalRooms: rooms.length,
    uniqueRooms: uniqueRooms.length,
    personalSpaceId,
    otherRooms: otherRooms.length,
    isLoading,
    roomIds: otherRooms.map(r => r.id),
    roomNames: otherRooms.map(r => r.name),
    personalSpaceInRooms: rooms.filter(r => r.isPersonalSpace).map(r => r.id),
  });

  return (
    <>
      {/* Personal Space - Always shown */}
      {personalSpaceRoom && (
        <PersonalSpaceItem 
          key={`personal-space-${personalSpaceRoom.id}`}
          selectedRoom={selectedRoom} 
          onSelect={onSelectRoom} 
          rooms={rooms} 
        />
      )}

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

