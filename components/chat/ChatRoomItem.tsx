'use client';

import type { ChatRoom } from './types';
import type { User } from '@/stores/useAuthStore';

interface ChatRoomItemProps {
  room: ChatRoom;
  user: User | null;
  isSelected: boolean;
  onSelect: (room: ChatRoom) => void;
}

export function ChatRoomItem({ room, user, isSelected, onSelect }: ChatRoomItemProps) {
  const getOtherMember = (room: ChatRoom) => {
    if (room.type === 'DM' && room.members) {
      return room.members.find((m) => m.id !== user?.id);
    }
    return null;
  };

  const getRoomDisplayName = (room: ChatRoom) => {
    if (room.isPersonalSpace) {
      return `${user?.name || user?.email || '사용자'}(나)`;
    }
    if (room.type === 'DM') {
      const otherMember = getOtherMember(room);
      return otherMember?.name || otherMember?.email || '알 수 없음';
    }
    return room.name || '채팅방';
  };

  const getRoomAvatar = (room: ChatRoom) => {
    if (room.isPersonalSpace) {
      return user?.profileImageUrl || null;
    }
    if (room.type === 'DM') {
      const otherMember = getOtherMember(room);
      return otherMember?.profileImageUrl;
    }
    return null;
  };

  return (
    <div
      className={`chat-dm-item ${isSelected ? 'chat-dm-item-selected' : ''}`}
      onClick={() => onSelect(room)}
    >
      <div className="chat-avatar">
        {getRoomAvatar(room) ? (
          <img src={getRoomAvatar(room)!} alt={getRoomDisplayName(room)} />
        ) : (
          <div className="chat-avatar-placeholder"></div>
        )}
      </div>
      <div className="chat-dm-item-content">
        <div className="chat-dm-item-name">
          {getRoomDisplayName(room)}
        </div>
        {room.lastMessage && (
          <div className="chat-dm-item-last-message">
            {room.lastMessage.content}
          </div>
        )}
      </div>
    </div>
  );
}

