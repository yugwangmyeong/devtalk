'use client';

import { useEffect, useRef, useState } from 'react';
import type { Message } from './types';
import { getProfileImageUrl } from '@/lib/utils';

interface MessageItemProps {
  message: Message;
  isOwnMessage: boolean;
  roomType: string;
  isAnnouncementChannel?: boolean;
  showTime?: boolean;
  showAvatar?: boolean;
  showSenderName?: boolean;
  previousMessage?: Message | null;
  nextMessage?: Message | null;
  canPromoteToAnnouncement?: boolean;
  onPromoteToAnnouncement?: (message: Message) => void;
  onMessageUpdate?: (message: Message) => void;
  onMessageDelete?: (messageId: string) => void;
}

export function MessageItem({
  message,
  isOwnMessage,
  roomType,
  isAnnouncementChannel = false,
  showTime = true,
  showAvatar = true,
  showSenderName = true,
  previousMessage,
  nextMessage,
  canPromoteToAnnouncement,
  onPromoteToAnnouncement,
  onMessageUpdate,
  onMessageDelete,
}: MessageItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showEditInput, setShowEditInput] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number; placement: 'above' | 'below' } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const editInputRef = useRef<HTMLTextAreaElement | null>(null);
  const messageContainerRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  // ESC 키로 메뉴 닫기
  useEffect(() => {
    if (!showMenu) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMenu(false);
        setIsHovered(false);
        setMenuPosition(null);
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showMenu]);

  // 수정 입력창 포커스
  useEffect(() => {
    if (showEditInput && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.setSelectionRange(
        editInputRef.current.value.length,
        editInputRef.current.value.length
      );
    }
  }, [showEditInput]);


  const handlePromoteToAnnouncement = () => {
    if (!onPromoteToAnnouncement) {
      return;
    }
    onPromoteToAnnouncement(message);
    setShowMenu(false);
  };

  // 메뉴 토글
  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isOwnMessage || canPromoteToAnnouncement) {
      if (menuButtonRef.current) {
        const rect = menuButtonRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        const menuHeight = 150; // 예상 메뉴 높이
        
        // 아래쪽 공간이 충분하면 아래로, 아니면 위로
        const placement = spaceBelow >= menuHeight || spaceBelow > spaceAbove ? 'below' : 'above';
        
        setMenuPosition({
          x: rect.right + 8, // 버튼 오른쪽에서 8px 떨어진 위치
          y: placement === 'below' ? rect.top : rect.bottom,
          placement,
        });
      }
      setShowMenu((prev) => !prev);
    }
  };

  // 메시지 수정
  const handleEdit = async () => {
    if (!editContent.trim() || editContent === message.content) {
      setShowEditInput(false);
      setEditContent(message.content);
      return;
    }

    setIsEditing(true);
    try {
      const response = await fetch(`/api/chat/messages/${message.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ content: editContent.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        if (onMessageUpdate) {
          onMessageUpdate(data.message);
        }
        setShowEditInput(false);
        setShowMenu(false);
      } else {
        const errorData = await response.json();
        alert(errorData.error || '메시지 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to update message:', error);
      alert('메시지 수정에 실패했습니다.');
    } finally {
      setIsEditing(false);
    }
  };

  // 메시지 삭제
  const handleDelete = async () => {
    if (!confirm('정말 이 메시지를 삭제하시겠습니까?')) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/chat/messages/${message.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        if (onMessageDelete) {
          onMessageDelete(message.id);
        }
        setShowMenu(false);
      } else {
        const errorData = await response.json();
        alert(errorData.error || '메시지 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
      alert('메시지 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  // 수정 취소
  const handleCancelEdit = () => {
    setShowEditInput(false);
    setEditContent(message.content);
    setShowMenu(false);
  };

  // 수정된 메시지인지 확인
  const isEdited = message.updatedAt && 
    new Date(message.updatedAt).getTime() > new Date(message.createdAt).getTime() + 1000; // 1초 이상 차이
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
    const displayHours =
      hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
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
        const daysDiff = Math.floor(
          (today.getTime() - messageDate.getTime()) / 86400000
        );
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
    const displayHours =
      hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;

    return `${year}.${month}.${day}.${period} ${displayHours}:${minutes}`;
  };

  const formatSimpleTime = (dateString: string) => {
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
    const displayHours =
      hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;

    return `${period} ${displayHours}:${mins}`;
  };

  const formatTimeForChannel = (dateString: string) => {
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
    const displayHours =
      hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    const timeString = `${period} ${displayHours}:${mins}`;

    // 오늘인지 확인
    const today = new Date();
    const messageDate = new Date(dateString);
    const isToday =
      today.getFullYear() === messageDate.getFullYear() &&
      today.getMonth() === messageDate.getMonth() &&
      today.getDate() === messageDate.getDate();

    // 오늘이면 시간만 표시
    if (isToday) {
      return timeString;
    }

    // 어제인지 확인
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      yesterday.getFullYear() === messageDate.getFullYear() &&
      yesterday.getMonth() === messageDate.getMonth() &&
      yesterday.getDate() === messageDate.getDate();

    if (isYesterday) {
      return `어제 ${timeString}`;
    }

    // 그 외는 날짜 포함
    const year = messageDate.getFullYear().toString().slice(-2);
    const month = String(messageDate.getMonth() + 1).padStart(2, '0');
    const day = String(messageDate.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}. ${timeString}`;
  };

  // 개인 DM인 경우와 워크스페이스 채널인 경우를 구분
  const isDM = roomType === 'DM';

  // 채널인 경우: 모든 메시지가 왼쪽에 프로필, 이름, 시간 표시
  // DM인 경우: 기존 디자인 (본인은 오른쪽, 상대방은 왼쪽)
  if (!isDM) {
    // 같은 사용자가 1분 이내에 보낸 메시지인지 확인
    let isWithinOneMinute = false;
    if (previousMessage) {
      const currentTime = new Date(message.createdAt).getTime();
      const prevTime = new Date(previousMessage.createdAt).getTime();
      const timeDiff = currentTime - prevTime;
      const isSameUserAsPrev =
        message.userId === previousMessage.userId ||
        message.user.id === previousMessage.user.id;

      // 같은 사용자가 1분(60000ms) 이내에 보낸 메시지인지 확인
      isWithinOneMinute = isSameUserAsPrev && timeDiff <= 60000;
    }

    // chat-message-header 안에 있는 chat-message-sender 옆에 시간 표시
    // 1분 이내에 보낸 메시지이고 이름이 표시될 때 시간을 이름 옆에 표시
    if (isAnnouncementChannel) {
      const [headerLine, ...bodyLines] = message.content.split('\n');
      let headerLabel = message.user.name || message.user.email;
      if (headerLine?.startsWith('📣')) {
        const [namePart] = headerLine.split('•');
        if (namePart) {
          headerLabel = namePart.replace(/^📣\s*/, '').trim();
        }
      }
      const bodyText = bodyLines.join('\n').trim() || message.content;

      return (
        <div className="chat-message chat-message-announcement">
          <div className="chat-message-announcement-grid">
            <div className="chat-message-announcement-marker">📣</div>
            <div className="chat-message-announcement-card">
              <div className="chat-message-announcement-header">
                <div className="chat-message-announcement-author">
                  <span className="chat-message-announcement-author-name">
                    {headerLabel}
                  </span>
                  {message.user.teamRole === 'ADMIN' && (
                    <span className="chat-message-role-badge" title="관리자">
                      ⭐
                    </span>
                  )}
                </div>
                <div className="chat-message-announcement-time">
                  {formatTimeForChannel(message.createdAt)}
                </div>
              </div>
              <div className="chat-message-announcement-body">
                {bodyText}
              </div>
            </div>
          </div>
        </div>
      );
    }

    const shouldShowTimeInHeader = showSenderName && isWithinOneMinute;
    const messageTextClassName = 'chat-message-text';

    const hasMenuActions = isOwnMessage || canPromoteToAnnouncement;

    return (
      <div 
        className="chat-message chat-message-channel"
        ref={messageContainerRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          // 메뉴가 열려있으면 hover 상태 유지
          if (!showMenu) {
            setIsHovered(false);
          }
        }}
      >
        {showAvatar ? (
          <div className="chat-message-avatar">
            <img
              src={getProfileImageUrl(message.user.profileImageUrl)}
              alt={message.user.name || message.user.email}
            />
          </div>
        ) : (
          <div className="chat-message-avatar-spacer"></div>
        )}
        <div className="chat-message-content">
          {showSenderName && (
            <div className="chat-message-header">
              <span className="chat-message-sender">
                {message.user.name || message.user.email}
                {(message.user.teamRole === 'OWNER' ||
                  message.user.teamRole === 'ADMIN') && (
                  <span
                    className="chat-message-role-badge"
                    title={
                      message.user.teamRole === 'OWNER' ? '소유자' : '관리자'
                    }
                  >
                    {message.user.teamRole === 'OWNER' ? '👑' : '⭐'}
                  </span>
                )}
              </span>
              {/* 같은 사용자가 1분 이내에 보낸 메시지일 경우 시간을 이름 옆에 표시 */}
              {shouldShowTimeInHeader && (
                <span className="chat-message-time">
                  {formatSimpleTime(message.createdAt)}
                </span>
              )}
            </div>
          )}
          <div className="chat-message-text-wrapper">
            <div className="chat-message-text-action-container">
              {showEditInput ? (
                <div className="chat-message-edit-container">
                  <textarea
                    ref={editInputRef}
                    className="chat-message-edit-input"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleEdit();
                      } else if (e.key === 'Escape') {
                        handleCancelEdit();
                      }
                    }}
                    rows={Math.min(editContent.split('\n').length, 10)}
                  />
                  <div className="chat-message-edit-actions">
                    <button
                      type="button"
                      className="chat-message-edit-button primary"
                      onClick={handleEdit}
                      disabled={isEditing || !editContent.trim() || editContent === message.content}
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      className="chat-message-edit-button"
                      onClick={handleCancelEdit}
                      disabled={isEditing}
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="chat-message-text-content-wrapper">
                    <div className={messageTextClassName}>
                      {message.content}
                      {isEdited && (
                        <span className="chat-message-edited"> (수정됨)</span>
                      )}
                    </div>
                    {hasMenuActions && (
                      <button
                        ref={menuButtonRef}
                        type="button"
                        className={`chat-message-menu-button ${isHovered || showMenu ? 'visible' : ''}`}
                        onClick={handleMenuToggle}
                        aria-label="메시지 메뉴"
                        title="메시지 옵션"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="8" cy="4" r="1.5" fill="currentColor"/>
                          <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
                          <circle cx="8" cy="12" r="1.5" fill="currentColor"/>
                        </svg>
                      </button>
                    )}
                  </div>
                  {hasMenuActions && showMenu && menuPosition && (
                    <>
                      <div 
                        className="chat-message-menu-backdrop"
                        onClick={() => {
                          setShowMenu(false);
                          setMenuPosition(null);
                        }}
                      />
                      <div 
                        className={`chat-message-menu-overlay ${menuPosition.placement}`}
                        ref={menuRef}
                        style={{
                          left: `${menuPosition.x}px`,
                          top: menuPosition.placement === 'below' ? `${menuPosition.y}px` : 'auto',
                          bottom: menuPosition.placement === 'above' ? `${window.innerHeight - menuPosition.y}px` : 'auto',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="chat-message-menu">
                          {isOwnMessage && (
                            <>
                              <button
                                type="button"
                                className="chat-message-menu-item"
                                onClick={() => {
                                  setShowEditInput(true);
                                  setShowMenu(false);
                                  setMenuPosition(null);
                                }}
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                className="chat-message-menu-item"
                                onClick={handleDelete}
                                disabled={isDeleting}
                              >
                                삭제
                              </button>
                            </>
                          )}
                          {canPromoteToAnnouncement && onPromoteToAnnouncement && (
                            <button
                              type="button"
                              className="chat-message-menu-item"
                              onClick={handlePromoteToAnnouncement}
                            >
                              공지로 보내기
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            {/* 이름 옆에 시간이 표시되지 않을 때만 메시지 옆에 시간 표시 */}
            {showTime && !shouldShowTimeInHeader && (
              <span className="chat-message-time">
                {formatTimeForChannel(message.createdAt)}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // DM: 기존 디자인 (본인은 오른쪽, 상대방은 왼쪽)
  const dmMessageClassName = `chat-message ${
    isOwnMessage ? 'chat-message-own' : ''
  }`;

  return (
    <div 
      className={dmMessageClassName}
      ref={messageContainerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        // 메뉴가 열려있으면 hover 상태 유지
        if (!showMenu) {
          setIsHovered(false);
        }
      }}
    >
      {!isOwnMessage && (
        <>
          {showAvatar ? (
            <div className="chat-message-avatar">
              <img
                src={getProfileImageUrl(message.user.profileImageUrl)}
                alt={message.user.name || message.user.email}
              />
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
          <div className="chat-message-text-action-container">
            {showEditInput ? (
              <div className="chat-message-edit-container">
                <textarea
                  ref={editInputRef}
                  className="chat-message-edit-input"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleEdit();
                    } else if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                  rows={Math.min(editContent.split('\n').length, 10)}
                />
                <div className="chat-message-edit-actions">
                  <button
                    type="button"
                    className="chat-message-edit-button primary"
                    onClick={handleEdit}
                    disabled={isEditing || !editContent.trim() || editContent === message.content}
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    className="chat-message-edit-button"
                    onClick={handleCancelEdit}
                    disabled={isEditing}
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="chat-message-text-content-wrapper">
                  <div className="chat-message-text">
                    {message.content}
                    {isEdited && (
                      <span className="chat-message-edited"> (수정됨)</span>
                    )}
                  </div>
                  {isOwnMessage && (
                    <button
                      ref={menuButtonRef}
                      type="button"
                      className={`chat-message-menu-button ${isHovered || showMenu ? 'visible' : ''}`}
                      onClick={handleMenuToggle}
                      aria-label="메시지 메뉴"
                      title="메시지 옵션"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="8" cy="4" r="1.5" fill="currentColor"/>
                        <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
                        <circle cx="8" cy="12" r="1.5" fill="currentColor"/>
                      </svg>
                    </button>
                  )}
                </div>
                {isOwnMessage && showMenu && menuPosition && (
                  <>
                    <div 
                      className="chat-message-menu-backdrop"
                      onClick={() => {
                        setShowMenu(false);
                        setMenuPosition(null);
                      }}
                    />
                    <div 
                      className={`chat-message-menu-overlay ${menuPosition.placement}`}
                      ref={menuRef}
                      style={{
                        left: `${menuPosition.x}px`,
                        top: menuPosition.placement === 'below' ? `${menuPosition.y}px` : 'auto',
                        bottom: menuPosition.placement === 'above' ? `${window.innerHeight - menuPosition.y}px` : 'auto',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="chat-message-menu">
                        <button
                          type="button"
                          className="chat-message-menu-item"
                          onClick={() => {
                            setShowEditInput(true);
                            setShowMenu(false);
                            setMenuPosition(null);
                          }}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          className="chat-message-menu-item"
                          onClick={handleDelete}
                          disabled={isDeleting}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
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

