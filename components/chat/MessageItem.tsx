'use client';

import type { Message } from './types';

interface MessageItemProps {
  message: Message;
  isOwnMessage: boolean;
}

export function MessageItem({ message, isOwnMessage }: MessageItemProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return date.toLocaleDateString('ko-KR');
  };

  return (
    <div className={`chat-message ${isOwnMessage ? 'chat-message-own' : ''}`}>
      {!isOwnMessage && (
        <div className="chat-message-avatar">
          {message.user.profileImageUrl ? (
            <img src={message.user.profileImageUrl} alt={message.user.name || message.user.email} />
          ) : (
            <div className="chat-message-avatar-placeholder"></div>
          )}
        </div>
      )}
      <div className="chat-message-content">
        {!isOwnMessage && (
          <div className="chat-message-sender">
            {message.user.name || message.user.email}
          </div>
        )}
        <div className="chat-message-text">{message.content}</div>
        <div className="chat-message-time">
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

