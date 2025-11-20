'use client';

import { useRef, useEffect, Fragment } from 'react';
import { MessageItem } from './MessageItem';
import type { Message } from './types';

interface MessagesListProps {
  messages: Message[];
  currentUserId: string | undefined;
  isLoading: boolean;
  isPersonalSpace?: boolean;
  roomType: string;
  roomName?: string;
}

export function MessagesList({ messages, currentUserId, isLoading, isPersonalSpace, roomType, roomName }: MessagesListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const formatDateDivider = (dateString: string) => {
    return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' }).format(new Date(dateString));
  };
  const isSameDay = (dateA: Date, dateB: Date) => {
    return (
      dateA.getFullYear() === dateB.getFullYear() &&
      dateA.getMonth() === dateB.getMonth() &&
      dateA.getDate() === dateB.getDate()
    );
  };
  
  console.log('[MessagesList] Rendering with roomType:', roomType, 'isPersonalSpace:', isPersonalSpace, 'messages count:', messages.length);

  // 메시지가 로드되거나 새 메시지가 추가되면 맨 아래로 스크롤
  useEffect(() => {
    if (messages.length > 0 && !isLoading) {
      // 약간의 지연을 두어 DOM이 업데이트된 후 스크롤
      setTimeout(() => {
        const container = messagesContainerRef.current?.parentElement as HTMLElement;
        if (container) {
          // 스크롤을 맨 아래로 이동 (카카오톡처럼)
          container.scrollTop = container.scrollHeight;
        } else {
          // fallback: messagesEndRef 사용
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }
      }, 100);
    }
  }, [messages.length, isLoading]);

  if (isLoading) {
    return <div className="chat-loading">메시지 로딩 중...</div>;
  }

  return (
    <div className="chat-messages-list" ref={messagesContainerRef}>
      {messages.length === 0 ? (
        <div className="chat-empty-messages">
          {isPersonalSpace ? (
            <div className="chat-empty-messages-content">
              <div className="chat-empty-messages-icon">💭</div>
              <div className="chat-empty-messages-title">나만의 공간</div>
              <div className="chat-empty-messages-text">메모나 생각을 기록해보세요</div>
            </div>
          ) : roomType === 'DM' ? (
            <div className="chat-empty-messages-content">
              <div className="chat-empty-messages-icon">💬</div>
              <div className="chat-empty-messages-title">대화를 시작해보세요</div>
              <div className="chat-empty-messages-text">{roomName ? `${roomName}님과 대화를 시작해보세요` : '첫 메시지를 보내보세요'}</div>
            </div>
          ) : (
            <div className="chat-empty-messages-content">
              <div className="chat-empty-messages-icon">📢</div>
              <div className="chat-empty-messages-title">채널에 메시지를 보내보세요</div>
              <div className="chat-empty-messages-text">첫 메시지를 작성해보세요</div>
            </div>
          )}
        </div>
      ) : (
        // 중복 제거: 같은 ID를 가진 메시지가 여러 개 있으면 하나만 렌더링
        (() => {
          const uniqueMessages = messages.reduce((acc: Message[], message: Message) => {
            const exists = acc.some(m => m.id === message.id);
            if (!exists) {
              acc.push(message);
            }
            return acc;
          }, []);
          
          return uniqueMessages.map((message, index) => {
          // 개인 공간인 경우 모든 메시지를 오른쪽에 표시 (메모장처럼 사용)
          const isOwnMessage = isPersonalSpace 
            ? true 
            : currentUserId 
              ? (message.user.id === currentUserId || message.userId === currentUserId)
              : false;

          // DM과 채널 모두에서 연속 메시지 처리
          let showTime = true;
          let showAvatar = true;
          let showSenderName = true;
          
          const previousMessage = index > 0 ? uniqueMessages[index - 1] : null;
          const nextMessage = uniqueMessages[index + 1];
          const currentMessageDate = new Date(message.createdAt);
          const shouldShowDateDivider = !previousMessage || !isSameDay(currentMessageDate, new Date(previousMessage.createdAt));
          
          if (roomType === 'DM') {
            // DM: 프로필과 이름 - 1분 이내 연속 메시지면 숨김
            if (!isOwnMessage && previousMessage) {
              const currentTime = new Date(message.createdAt).getTime();
              const prevTime = new Date(previousMessage.createdAt).getTime();
              const timeDiff = currentTime - prevTime;
              const isSameUserAsPrev = message.userId === previousMessage.userId ||
                message.user.id === previousMessage.user.id;

              if (isSameUserAsPrev && timeDiff <= 60000) {
                showAvatar = false;
                showSenderName = false;
              }
            }
            
            // DM: 시간 - 1분 이내 연속 메시지면 숨김
            if (nextMessage) {
              const currentTime = new Date(message.createdAt).getTime();
              const nextTime = new Date(nextMessage.createdAt).getTime();
              const timeDiff = nextTime - currentTime;
              const isSameUserAsNext = message.userId === nextMessage.userId ||
                message.user.id === nextMessage.user.id;

              if (isSameUserAsNext && timeDiff <= 60000) {
                showTime = false;
              }
            }
          } else {
            // 채널: 프로필과 이름 - 10분 이내 연속 메시지면 숨김
            if (previousMessage) {
              const currentTime = new Date(message.createdAt).getTime();
              const prevTime = new Date(previousMessage.createdAt).getTime();
              const timeDiff = currentTime - prevTime;
              const isSameUserAsPrev = message.userId === previousMessage.userId ||
                message.user.id === previousMessage.user.id;

              // 10분(600000ms) 이내이고 같은 사용자면 프로필/이름 숨김
              if (isSameUserAsPrev && timeDiff <= 600000) {
                showAvatar = false;
                showSenderName = false;
              }
            }
            
            // 채널: 같은 사용자가 1분 이내에 보낸 연속 메시지 중 첫 번째에만 시간 표시
            // 다음 메시지가 같은 사용자가 1분 이내에 보낸 메시지면 시간 숨김
            if (nextMessage) {
              const currentTime = new Date(message.createdAt).getTime();
              const nextTime = new Date(nextMessage.createdAt).getTime();
              const timeDiff = nextTime - currentTime;
              const isSameUserAsNext = message.userId === nextMessage.userId ||
                message.user.id === nextMessage.user.id;

              // 같은 사용자가 1분(60000ms) 이내에 보낸 메시지면 시간 숨김 (첫 번째만 표시)
              if (isSameUserAsNext && timeDiff <= 60000) {
                showTime = false;
              }
            }
          }
          
          return (
            <Fragment key={message.id}>
              {shouldShowDateDivider && (
                <div className="chat-date-divider">
                  <span>{formatDateDivider(message.createdAt)}</span>
                </div>
              )}
              <MessageItem
                message={message}
                isOwnMessage={isOwnMessage}
                roomType={roomType}
                showTime={showTime}
                showAvatar={showAvatar}
                showSenderName={showSenderName}
                previousMessage={previousMessage}
                nextMessage={nextMessage}
              />
            </Fragment>
          );
        });
        })()
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

