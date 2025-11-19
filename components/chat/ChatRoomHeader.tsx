'use client';

import { useState, useEffect } from 'react';
import type { ChatRoom } from './types';
import type { User } from '@/stores/useAuthStore';
import { getProfileImageUrl } from '@/lib/utils';

interface ChatRoomHeaderProps {
  room: ChatRoom;
  user: User | null;
}

export function ChatRoomHeader({ room, user }: ChatRoomHeaderProps) {
  const [roomUser, setRoomUser] = useState<{ id: string; name: string | null; email: string; profileImageUrl: string | null } | null>(null);

  // 개인 공간인 경우 DB에서 사용자 정보 가져오기
  useEffect(() => {
    if (!room.isPersonalSpace) {
      setRoomUser(null);
      return;
    }

    // room.members에 사용자 정보가 있으면 사용
    if (room.members?.[0]) {
      const member = room.members[0];
      // 이미 같은 사용자 정보면 업데이트하지 않음
      if (!roomUser || roomUser.id !== member.id) {
        setRoomUser({
          id: member.id,
          name: member.name,
          email: member.email,
          profileImageUrl: member.profileImageUrl,
        });
      }
      return;
    }

    // 없으면 API 호출해서 가져오기
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('/api/chat/personal-space');
        if (response.ok) {
          const data = await response.json();
          const personalRoom = data.room;
          if (personalRoom?.members?.[0]) {
            const member = personalRoom.members[0];
            setRoomUser({
              id: member.id,
              name: member.name,
              email: member.email,
              profileImageUrl: member.profileImageUrl,
            });
          }
        }
      } catch (error) {
        console.error('Failed to get personal space user info:', error);
      }
    };

    fetchUserInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.isPersonalSpace, room.members?.[0]?.id]);

  const getOtherMember = (room: ChatRoom) => {
    if (room.type === 'DM' && room.members) {
      return room.members.find((m) => m.id !== user?.id);
    }
    return null;
  };

  const getRoomDisplayName = (room: ChatRoom) => {
    if (room.isPersonalSpace) {
      // DB에서 가져온 사용자 정보 사용
      const displayUser = roomUser || room.members?.[0];
      return `${displayUser?.name || displayUser?.email || user?.name || user?.email || '사용자'}(나)`;
    }
    if (room.type === 'DM') {
      const otherMember = getOtherMember(room);
      return otherMember?.name || otherMember?.email || '알 수 없음';
    }
    return room.name || '채팅방';
  };

  const getRoomAvatar = (room: ChatRoom) => {
    if (room.isPersonalSpace) {
      // DB에서 가져온 사용자 정보 사용
      const displayUser = roomUser || room.members?.[0];
      return getProfileImageUrl(displayUser?.profileImageUrl || user?.profileImageUrl);
    }
    if (room.type === 'DM') {
      const otherMember = getOtherMember(room);
      return getProfileImageUrl(otherMember?.profileImageUrl);
    }
    return getProfileImageUrl(null);
  };

  return (
    <div className="chat-room-header">
      <div className="chat-room-header-info">
        <div className="chat-room-avatar">
          <img src={getRoomAvatar(room)} alt={getRoomDisplayName(room)} />
        </div>
        <div className="chat-room-header-text">
          <div className="chat-room-name">
            {getRoomDisplayName(room)}
          </div>
          <div className="chat-room-status">
            {room.isPersonalSpace ? '나만의 공간' : '온라인'}
          </div>
        </div>
      </div>
      <div className="chat-room-header-actions">
        <button className="chat-room-action-button">
          <svg className="chat-room-action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
        <button className="chat-room-action-button">
          <svg className="chat-room-action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

