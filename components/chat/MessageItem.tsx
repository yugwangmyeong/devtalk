'use client';

import type { Message } from './types';

interface MessageItemProps {
  message: Message;
  isOwnMessage: boolean;
  roomType: string;
  showTime?: boolean;
  showAvatar?: boolean;
  showSenderName?: boolean;
  previousMessage?: Message | null;
}

export function MessageItem({ message, isOwnMessage, roomType, showTime = true, showAvatar = true, showSenderName = true, previousMessage }: MessageItemProps) {
  const formatTime = (dateString: string, prevMessageDate?: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    // 10분 이내는 "10분 전" 형식
    if (minutes <= 10) {
      if (minutes < 1) return '방금';
      return `${minutes}분 전`;
    }
    
    // 시간 형식 (오전/오후)
    const hours = date.getHours();
    const mins = String(date.getMinutes()).padStart(2, '0');
    const period = hours >= 12 ? '오후' : '오전';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    const timeString = `${period} ${displayHours}:${mins}`;
    
    // 날짜 변경 감지
    let isDateChanged = false;
    if (prevMessageDate) {
      const prevDate = new Date(prevMessageDate);
      const currentDate = new Date(dateString);
      
      // 날짜가 다른지 확인 (년, 월, 일 비교)
      isDateChanged = 
        prevDate.getFullYear() !== currentDate.getFullYear() ||
        prevDate.getMonth() !== currentDate.getMonth() ||
        prevDate.getDate() !== currentDate.getDate();
    } else {
      // 첫 메시지인 경우 날짜 변경으로 간주
      isDateChanged = true;
    }
    
    // 날짜가 변경된 경우에만 날짜 정보 표시
    if (isDateChanged) {
      const today = new Date();
      const messageDate = new Date(dateString);
      
      // 오늘인지 확인
      const isToday = 
        today.getFullYear() === messageDate.getFullYear() &&
        today.getMonth() === messageDate.getMonth() &&
        today.getDate() === messageDate.getDate();
      
      // 어제인지 확인
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = 
        yesterday.getFullYear() === messageDate.getFullYear() &&
        yesterday.getMonth() === messageDate.getMonth() &&
        yesterday.getDate() === messageDate.getDate();
      
      if (isToday) {
        return timeString;
      } else if (isYesterday) {
        return `어제 ${timeString}`;
      } else {
        const daysDiff = Math.floor((today.getTime() - messageDate.getTime()) / 86400000);
        if (daysDiff < 7) {
          return `${daysDiff}일 전 ${timeString}`;
        } else {
          const year = messageDate.getFullYear().toString().slice(-2);
          const month = String(messageDate.getMonth() + 1).padStart(2, '0');
          const day = String(messageDate.getDate()).padStart(2, '0');
          return `${year}.${month}.${day}. ${timeString}`;
        }
      }
    }
    
    // 날짜가 변경되지 않은 경우 시간만 표시
    return timeString;
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
        <>
          {showAvatar ? (
            <div className="chat-message-avatar">
              {message.user.profileImageUrl ? (
                <img src={message.user.profileImageUrl} alt={message.user.name || message.user.email} />
              ) : (
                <div className="chat-message-avatar-placeholder"></div>
              )}
            </div>
          ) : (
            <div className="chat-message-avatar-spacer"></div>
          )}
        </>
      )}
      <div className="chat-message-content">
        {!isOwnMessage && showSenderName && (
          <div className="chat-message-sender">
            {message.user.name || message.user.email}
          </div>
        )}
        <div className="chat-message-text-wrapper">
          {isOwnMessage && showTime && (
            <div className="chat-message-time-separate">
              {formatTime(message.createdAt, previousMessage?.createdAt)}
            </div>
          )}
          <div className="chat-message-text">
            {message.content}
          </div>
          {!isOwnMessage && showTime && (
            <div className="chat-message-time-separate">
              {formatTime(message.createdAt, previousMessage?.createdAt)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

