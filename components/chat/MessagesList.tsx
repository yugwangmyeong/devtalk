'use client';

import { useRef, useEffect } from 'react';
import { MessageItem } from './MessageItem';
import type { Message } from './types';

interface MessagesListProps {
  messages: Message[];
  currentUserId: string | undefined;
  isLoading: boolean;
  isPersonalSpace?: boolean;
  roomType: string;
}

export function MessagesList({ messages, currentUserId, isLoading, isPersonalSpace, roomType }: MessagesListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 메시지가 로드되면 맨 아래로 스크롤
  useEffect(() => {
    if (messages.length > 0 && !isLoading) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages, isLoading]);

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
        messages.map((message, index) => {
          // 개인 공간인 경우 모든 메시지를 오른쪽에 표시 (메모장처럼 사용)
          const isOwnMessage = isPersonalSpace 
            ? true 
            : currentUserId 
              ? (message.user.id === currentUserId || message.userId === currentUserId)
              : false;

          // 개인 채팅(DM)인 경우, 같은 사용자가 1분 이내에 보낸 연속 메시지 처리
          let showTime = true;
          let showAvatar = true;
          let showSenderName = true;
          
          const previousMessage = index > 0 ? messages[index - 1] : null;
          
          if (roomType === 'DM') {
            const nextMessage = messages[index + 1];
            
            // 프로필과 이름: 이전 메시지와 비교하여 첫 번째 메시지에만 표시
            if (!isOwnMessage && previousMessage) {
              const currentTime = new Date(message.createdAt).getTime();
              const prevTime = new Date(previousMessage.createdAt).getTime();
              const timeDiff = currentTime - prevTime;
              const isSameUserAsPrev = message.userId === previousMessage.userId ||
                message.user.id === previousMessage.user.id;

              // 이전 메시지가 같은 사용자가 보낸 것이고 1분(60000ms) 이내이면 프로필/이름 숨김
              if (isSameUserAsPrev && timeDiff <= 60000) {
                showAvatar = false;
                showSenderName = false;
              }
            }
            
            // 시간: 다음 메시지와 비교하여 마지막 메시지에만 표시
            if (nextMessage) {
              const currentTime = new Date(message.createdAt).getTime();
              const nextTime = new Date(nextMessage.createdAt).getTime();
              const timeDiff = nextTime - currentTime;
              const isSameUserAsNext = message.userId === nextMessage.userId ||
                message.user.id === nextMessage.user.id;

              // 다음 메시지가 같은 사용자가 보낸 것이고 1분(60000ms) 이내이면 시간 숨김
              if (isSameUserAsNext && timeDiff <= 60000) {
                showTime = false;
              }
            }
          }
          
          return (
            <MessageItem
              key={message.id}
              message={message}
              isOwnMessage={isOwnMessage}
              roomType={roomType}
              showTime={showTime}
              showAvatar={showAvatar}
              showSenderName={showSenderName}
              previousMessage={previousMessage}
            />
          );
        })
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

