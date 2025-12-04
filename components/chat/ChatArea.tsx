'use client';

import { useState } from 'react';
import { MessagesList } from './MessagesList';
import { MessageInput } from './MessageInput';
import { MessageSearchPanel } from './MessageSearchPanel';
import type { ChatRoom, Message } from './types';
import type { User } from '@/stores/useAuthStore';

interface ChatAreaProps {
  room: ChatRoom;
  messages: Message[];
  messageInput: string;
  user: User | null;
  isLoadingMessages: boolean;
  onMessageInputChange: (value: string) => void;
  onSendMessage: () => void;
  isWorkspaceChannel?: boolean;
  isAnnouncementChannel?: boolean;
  canPostAnnouncements?: boolean;
  canPromoteToAnnouncement?: boolean;
  announcementRoomId?: string;
  onPromoteToAnnouncement?: (message: Message) => void;
  onMessageUpdate?: (message: Message) => void;
  onMessageDelete?: (messageId: string) => void;
}

export function ChatArea({
  room,
  messages,
  messageInput,
  user,
  isLoadingMessages,
  onMessageInputChange,
  onSendMessage,
  isWorkspaceChannel = false,
  isAnnouncementChannel = false,
  canPostAnnouncements = false,
  canPromoteToAnnouncement = false,
  announcementRoomId,
  onPromoteToAnnouncement,
  onMessageUpdate,
  onMessageDelete,
}: ChatAreaProps) {
  // Get the other user in DM (not the current user)
  const getOtherUser = () => {
    if (room.isPersonalSpace) {
      return user; // Personal space shows current user
    }
    if (room.type === 'DM' && room.members) {
      return room.members.find((m) => m.id !== user?.id);
    }
    // For channels, return null (will show channel name)
    return null;
  };

  const otherUser = getOtherUser();
  const displayName = room.isPersonalSpace
    ? `${user?.name || user?.email || '사용자'}(나)`
    : room.type === 'DM' && otherUser
    ? otherUser.name || otherUser.email
    : room.name || '채팅방';
  
  const displayAvatar = room.isPersonalSpace
    ? user?.profileImageUrl
    : room.type === 'DM' && otherUser
    ? otherUser.profileImageUrl
    : null;

  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  console.log('[ChatArea] Rendering with room type:', room.type, 'room name:', room.name, 'isPersonalSpace:', room.isPersonalSpace);
  
  const shouldShowPromoteAction =
    Boolean(
      isWorkspaceChannel &&
      !isAnnouncementChannel &&
      canPromoteToAnnouncement &&
      announcementRoomId &&
      onPromoteToAnnouncement
    );

  const isInputDisabled = isAnnouncementChannel && !canPostAnnouncements;

  // 팀 워크스페이스 채널인지 확인 (DM이 아닌 경우)
  const isTeamWorkspaceChannel = room.type !== 'DM' && !room.isPersonalSpace;

  // 메시지 수정 시작 (채널인 경우만)
  const handleMessageEditStart = (message: Message) => {
    if (isTeamWorkspaceChannel) {
      setEditingMessage(message);
      onMessageInputChange(message.content);
    }
  };

  // 메시지 수정 취소
  const handleMessageEditCancel = () => {
    setEditingMessage(null);
    onMessageInputChange('');
  };

  // 메시지 수정 완료
  const handleMessageEditSave = async (content: string) => {
    if (!editingMessage) return;

    try {
      const response = await fetch(`/api/chat/messages/${editingMessage.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ content: content.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        if (onMessageUpdate) {
          onMessageUpdate(data.message);
        }
        setEditingMessage(null);
        onMessageInputChange('');
      } else {
        const errorData = await response.json();
        alert(errorData.error || '메시지 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to update message:', error);
      alert('메시지 수정에 실패했습니다.');
    }
  };

  return (
    <div className="chat-area-container">
      {/* Top Header with User Info and Search */}
      <div className="chat-area-header">
        <div className="chat-area-user-info">
          {displayAvatar ? (
            <img 
              src={displayAvatar} 
              alt={displayName}
              className="chat-area-user-avatar"
            />
          ) : (
            <div className="chat-area-user-avatar chat-area-user-avatar-placeholder">
              {displayName[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <span className="chat-area-user-name">{displayName}</span>
        </div>
        <button
          type="button"
          className="chat-area-search"
          onClick={() => setIsSearchPanelOpen(true)}
          aria-label="메시지 검색"
        >
          <svg className="chat-area-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>

      <div className="chat-area-content">
        <div className="chat-messages-wrapper">
          <div className="chat-messages-area">
            <MessagesList
              messages={messages}
              currentUserId={user?.id}
              isLoading={isLoadingMessages}
              isPersonalSpace={room.isPersonalSpace}
              roomType={room.type}
              roomName={displayName}
              isAnnouncementChannel={isAnnouncementChannel}
              canPromoteToAnnouncement={shouldShowPromoteAction}
              onPromoteToAnnouncement={shouldShowPromoteAction ? onPromoteToAnnouncement : undefined}
              onMessageUpdate={onMessageUpdate}
              onMessageDelete={onMessageDelete}
              onMessageEditStart={isTeamWorkspaceChannel ? handleMessageEditStart : undefined}
              editingMessageId={editingMessage?.id}
            />
          </div>

          {isSearchPanelOpen && (
            <>
              <div
                className={`chat-search-backdrop ${isSearchPanelOpen ? 'visible' : ''}`}
                onClick={() => setIsSearchPanelOpen(false)}
              />
              <div className="message-search-panel-overlay">
                <MessageSearchPanel
                  isOpen={isSearchPanelOpen}
                  onClose={() => setIsSearchPanelOpen(false)}
                  roomId={room.id}
                  onMessageClick={(message) => {
                    console.log('Message clicked:', message);
                  }}
                />
              </div>
            </>
          )}
        </div>

        {isAnnouncementChannel && (
          <div className={`chat-announcement-banner ${canPostAnnouncements ? 'chat-announcement-banner-manage' : ''}`}>
            {canPostAnnouncements ? '공지 채널입니다. 중요한 안내를 작성해보세요.' : '공지 채널은 운영진만 작성할 수 있습니다.'}
          </div>
        )}
        <MessageInput
          value={messageInput}
          onChange={onMessageInputChange}
          onSend={editingMessage ? () => handleMessageEditSave(messageInput) : onSendMessage}
          disabled={isInputDisabled}
          editingMessage={editingMessage}
          onCancelEdit={handleMessageEditCancel}
        />
      </div>
    </div>
  );
}

