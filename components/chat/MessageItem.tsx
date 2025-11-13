'use client';

import type { Message } from './types';

interface MessageItemProps {
  message: Message;
  isOwnMessage: boolean;
  roomType: string;
}

export function MessageItem({ message, isOwnMessage, roomType }: MessageItemProps) {
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

  const formatTimeForDM = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const period = hours >= 12 ? '오후' : '오전';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    
    return `${year}.${month}.${day}.${period} ${displayHours}:${minutes}`;
  };

  // 개인 DM인 경우와 워크스페이스 채널인 경우를 구분
  const isDM = roomType === 'DM';
  
  // 채널인 경우: 모든 메시지가 왼쪽에 프로필, 이름, 시간 표시
  // DM인 경우: 기존 디자인 (본인은 오른쪽, 상대방은 왼쪽)
  if (!isDM) {
    return (
      <div className="chat-message chat-message-channel">
        <div className="chat-message-avatar">
          {message.user.profileImageUrl ? (
            <img src={message.user.profileImageUrl} alt={message.user.name || message.user.email} />
          ) : (
            <div className="chat-message-avatar-placeholder"></div>
          )}
        </div>
        <div className="chat-message-content">
          <div className="chat-message-header">
            <span className="chat-message-sender">
              {message.user.name || message.user.email}
            </span>
            <span className="chat-message-time">
              {formatTimeForDM(message.createdAt)}
            </span>
          </div>
          <div className="chat-message-text">{message.content}</div>
        </div>
      </div>
    );
  }

  // DM: 기존 디자인 (본인은 오른쪽, 상대방은 왼쪽)
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

