'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import type { ChatRoom } from './types';

interface PersonalSpaceItemProps {
  selectedRoom: ChatRoom | null;
  onSelect: (room: ChatRoom) => void;
  rooms?: ChatRoom[]; // rooms 배열에서 개인 공간 찾기 위해
}

export function PersonalSpaceItem({ selectedRoom, onSelect, rooms }: PersonalSpaceItemProps) {
  const { user } = useAuthStore();
  const [roomUser, setRoomUser] = useState<{ name: string | null; email: string; profileImageUrl: string | null } | null>(null);

  // rooms 배열에서 개인 공간 찾기 (DB에서 가져온 최신 정보)
  const personalSpaceRoom = rooms?.find(r => r.isPersonalSpace);
  
  // 초기 로딩 시 DB에서 사용자 정보 가져오기
  useEffect(() => {
    const fetchUserInfo = async () => {
      // rooms 배열에 개인 공간이 있으면 사용
      if (personalSpaceRoom?.members?.[0]) {
        setRoomUser(personalSpaceRoom.members[0]);
        return;
      }

      // 없으면 API 호출해서 가져오기
      try {
        const response = await fetch('/api/chat/personal-space');
        if (response.ok) {
          const data = await response.json();
          const room = data.room;
          if (room?.members?.[0]) {
            setRoomUser(room.members[0]);
          }
        }
      } catch (error) {
        console.error('Failed to get personal space user info:', error);
      }
    };

    fetchUserInfo();
  }, [personalSpaceRoom]);

  // DB에서 가져온 사용자 정보 사용 (없으면 fallback으로 useAuthStore 사용)
  const displayName = roomUser?.name || roomUser?.email || user?.name || user?.email || '사용자';
  const profileImageUrl = roomUser?.profileImageUrl || user?.profileImageUrl;

  const handleClick = async () => {
    try {
      const response = await fetch('/api/chat/personal-space');
      if (response.ok) {
        const data = await response.json();
        const room = data.room;
        // 사용자 정보도 업데이트
        if (room?.members?.[0]) {
          setRoomUser(room.members[0]);
        }
        onSelect(room);
      }
    } catch (error) {
      console.error('Failed to get personal space:', error);
    }
  };

  return (
    <div
      className={`chat-dm-item ${selectedRoom?.isPersonalSpace ? 'chat-dm-item-selected' : ''}`}
      onClick={handleClick}
    >
      <div className="chat-avatar">
        {profileImageUrl ? (
          <img src={profileImageUrl} alt={displayName} />
        ) : (
          <div className="chat-avatar-placeholder"></div>
        )}
      </div>
      <div className="chat-dm-item-content">
        <div className="chat-dm-item-name">
          {displayName}(나)
        </div>
        <div className="chat-dm-item-description">
          여기는 나만의 공간입니다.
        </div>
        <div className="chat-dm-item-description">
          메모장, 할 일 목록 등으로 사용해주세요.
        </div>
      </div>
    </div>
  );
}

