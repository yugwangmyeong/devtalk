'use client';

import { useRef, useEffect } from 'react';
import { MessageItem } from './MessageItem';
import type { Message } from './types';

interface MessagesListProps {
  messages: Message[];
  currentUserId: string | undefined;
  isLoading: boolean;
  isPersonalSpace?: boolean;
}

export function MessagesList({ messages, currentUserId, isLoading, isPersonalSpace }: MessagesListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isLoading) {
    return <div className="chat-loading">메시지 로딩 중...</div>;
  }

  return (
    <div className="chat-messages-list">
      {messages.length === 0 ? (
        <div className="chat-empty-messages">
          메시지가 없습니다. 첫 메시지를 보내보세요!
        </div>
      ) : (
        messages.map((message) => {
          // 개인 공간인 경우 모든 메시지를 오른쪽에 표시 (메모장처럼 사용)
          const isOwnMessage = isPersonalSpace 
            ? true 
            : currentUserId 
              ? (message.user.id === currentUserId || message.userId === currentUserId)
              : false;
          
          return (
            <MessageItem
              key={message.id}
              message={message}
              isOwnMessage={isOwnMessage}
            />
          );
        })
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

