'use client';

import { useState } from 'react';
import { ChatRoomList } from './ChatRoomList';
import type { ChatRoom } from './types';
import type { User } from '@/stores/useAuthStore';

interface DMPanelProps {
  rooms: ChatRoom[];
  selectedRoom: ChatRoom | null;
  user: User | null;
  isLoadingRooms: boolean;
  onCreateDM: (email: string) => void;
  onSelectRoom: (room: ChatRoom) => void;
}

export function DMPanel({
  rooms,
  selectedRoom,
  user,
  isLoadingRooms,
  onCreateDM,
  onSelectRoom,
}: DMPanelProps) {
  console.log('[DMPanel] Render:', {
    roomsCount: rooms.length,
    isLoadingRooms,
    roomIds: rooms.map(r => r.id),
  });

  const [emailInput, setEmailInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!emailInput.trim()) {
      setError('이메일을 입력해주세요.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput.trim())) {
      setError('올바른 이메일 형식을 입력해주세요.');
      return;
    }
    setIsSearching(true);
    setError(null);
    try {
      await onCreateDM(emailInput.trim());
      setEmailInput('');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '채팅방 생성에 실패했습니다.';
      setError(errorMessage);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="chat-dm-panel">
      <div className="chat-dm-header">
        <h2 className="chat-dm-title">다이렉트 메시지(DM)</h2>
      </div>

      <div className="chat-dm-content">
        {/* <div className="chat-invitation-section">
          <p className="chat-invitation-text">
            DevTALK은 함께할때 더 즐거워집니다.
          </p>
          <p className="chat-invitation-text">
            이메일로 팀원을 찾아 대화하기
          </p>
          <form onSubmit={handleSearch} className="chat-email-search-form">
            <input
              type="email"
              placeholder="이메일 주소 입력"
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value);
                setError(null);
              }}
              className="chat-email-input"
              disabled={isSearching}
            />
            <button
              type="submit"
              className="chat-invite-button"
              disabled={isSearching}
            >
              {isSearching ? '검색 중...' : '채팅하기'}
            </button>
          </form>
          {error && (
            <p className="chat-error-message">
              {error}
            </p>
          )}
        </div> */}
        <ChatRoomList
          rooms={rooms}
          selectedRoom={selectedRoom}
          user={user}
          isLoading={isLoadingRooms}
          onSelectRoom={onSelectRoom}
        />
      </div>
    </div>
  );
}

