'use client';

import { useState } from 'react';
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
  const [activeTab, setActiveTab] = useState<'message' | 'text'>('message');

  return (
    <div className="chat-area-container">
      {/* Top Header with Tabs and Search */}
      <div className="chat-area-header">
        <div className="chat-area-tabs">
          <button
            className={`chat-area-tab ${activeTab === 'message' ? 'chat-area-tab-active' : ''}`}
            onClick={() => setActiveTab('message')}
          >
            메시지
          </button>
          <button
            className={`chat-area-tab ${activeTab === 'text' ? 'chat-area-tab-active' : ''}`}
            onClick={() => setActiveTab('text')}
          >
            텍스트
          </button>
        </div>
        <div className="chat-area-search">
          <svg className="chat-area-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
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

