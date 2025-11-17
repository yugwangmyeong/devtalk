'use client';

import { MessagesList } from './MessagesList';
import { MessageInput } from './MessageInput';
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
}

export function ChatArea({
  room,
  messages,
  messageInput,
  user,
  isLoadingMessages,
  onMessageInputChange,
  onSendMessage,
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

  console.log('[ChatArea] Rendering with room type:', room.type, 'room name:', room.name, 'isPersonalSpace:', room.isPersonalSpace);
  
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
        <div className="chat-area-search">
          {/* <svg className="chat-area-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg> */}
          <span className="chat-area-search-text">검색하기</span>
          <svg className="chat-area-search-magnifier" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Messages Area */}
      <div className="chat-messages-area">
        <MessagesList
          messages={messages}
          currentUserId={user?.id}
          isLoading={isLoadingMessages}
          isPersonalSpace={room.isPersonalSpace}
          roomType={room.type}
        />
      </div>

      {/* Message Input */}
      <MessageInput
        value={messageInput}
        onChange={onMessageInputChange}
        onSend={onSendMessage}
        disabled={false}
      />
    </div>
  );
}

