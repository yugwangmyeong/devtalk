'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useNotificationStore } from '@/stores/useNotificationStore';
import type { Notification } from '@/types/notification';
import './NotificationPanel.css';

export function NotificationPanel() {
  const {
    notifications,
    unreadCount,
    isOpen,
    markAsRead,
    markAllAsRead,
    removeNotification,
    closePanel,
  } = useNotificationStore();
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 패널 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        closePanel();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closePanel]);

  // 알림 클릭 핸들러
  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      // team_invite 알림은 클릭해도 이동하지 않음 (버튼으로 처리)
      if (notification.type === 'team_invite') {
        return;
      }

      markAsRead(notification.id);

      // 채팅방 알림인 경우 해당 채팅방으로 이동
      if (notification.roomId) {
        router.push(`/chat?roomId=${notification.roomId}`);
        closePanel();
      }
      // 팀 초대 알림인 경우 팀 페이지로 이동
      else if (notification.teamId) {
        router.push(`/teams?teamId=${notification.teamId}`);
        closePanel();
      }
    },
    [markAsRead, router, closePanel]
  );

  // 초대 수락 핸들러
  const handleAcceptInvite = useCallback(
    async (notification: Notification) => {
      if (!notification.teamId) return;

      try {
        const response = await fetch(`/api/teams/${notification.teamId}/members/accept`, {
          method: 'POST',
          credentials: 'include',
        });

        if (response.ok) {
          markAsRead(notification.id);
          removeNotification(notification.id);
          // 초대 수락 후 팀 페이지로 이동
          router.push(`/teams?teamId=${notification.teamId}`);
          closePanel();
        } else {
          const errorData = await response.json();
          alert(errorData.error || '초대 수락에 실패했습니다.');
        }
      } catch (error) {
        console.error('Failed to accept invite:', error);
        alert('초대 수락에 실패했습니다.');
      }
    },
    [markAsRead, removeNotification, router, closePanel]
  );

  // 초대 거절 핸들러
  const handleRejectInvite = useCallback(
    async (notification: Notification) => {
      if (!notification.teamId) return;

      try {
        const response = await fetch(`/api/teams/${notification.teamId}/members/reject`, {
          method: 'POST',
          credentials: 'include',
        });

        if (response.ok) {
          markAsRead(notification.id);
          removeNotification(notification.id);
        } else {
          const errorData = await response.json();
          alert(errorData.error || '초대 거절에 실패했습니다.');
        }
      } catch (error) {
        console.error('Failed to reject invite:', error);
        alert('초대 거절에 실패했습니다.');
      }
    },
    [markAsRead, removeNotification]
  );

  // 시간 포맷팅 헬퍼 함수
  const formatTime = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    // 10분 전까지는 상대 시간 표시
    if (diffMins < 1) return '방금 전';
    if (diffMins < 10) return `${diffMins}분 전`;
    
    // 시간 포맷팅
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? '오후' : '오전';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    const timeString = `${ampm} ${displayHours}:${displayMinutes}`;
    
    // 날짜 비교
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // 오늘인 경우
    if (messageDate.getTime() === today.getTime()) {
      return timeString;
    }
    
    // 어제인 경우
    if (messageDate.getTime() === yesterday.getTime()) {
      return `어제 ${timeString}`;
    }
    
    // 그 이전인 경우 날짜와 시간 표시
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${year}.${month}.${day} ${timeString}`;
  }, []);

  // 알림 타입별 아이콘
  const getNotificationIcon = useCallback((type: Notification['type']) => {
    const iconProps = {
      className: 'notification-icon',
      fill: 'none',
      stroke: 'currentColor',
      viewBox: '0 0 24 24',
    };

    switch (type) {
      case 'chat_invite':
        return (
          <svg {...iconProps}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'message':
        return (
          <svg {...iconProps}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        );
      case 'room_created':
        return (
          <svg {...iconProps}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        );
      case 'user_joined':
        return (
          <svg {...iconProps}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'team_invite':
        return (
          <svg {...iconProps}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        );
      default:
        return null;
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="notification-panel" ref={panelRef}>
      <div className="notification-panel-header">
        <h3 className="notification-panel-title">알림</h3>
        {unreadCount > 0 && (
          <button
            className="notification-mark-all-read"
            onClick={markAllAsRead}
            aria-label="모든 알림 읽음 처리"
          >
            모두 읽음
          </button>
        )}
      </div>

      <div className="notification-panel-content">
        {notifications.length === 0 ? (
          <div className="notification-empty">
            <p>알림이 없습니다</p>
          </div>
        ) : (
          <div className="notification-list">
            {notifications.map((notification) => {
              // 디버깅: 메시지 알림의 경우 사용자 정보 확인
              if (notification.type === 'message') {
                console.log('[NotificationPanel] Rendering message notification:', {
                  id: notification.id,
                  userId: notification.user?.id,
                  profileImageUrl: notification.user?.profileImageUrl,
                  profileImageUrlType: typeof notification.user?.profileImageUrl,
                  hasUser: !!notification.user,
                  userObject: notification.user,
                });
              }
              
              return (
              <div
                key={notification.id}
                className={`notification-item ${!notification.read ? 'unread' : ''} ${notification.type === 'team_invite' ? 'notification-item-invite' : ''}`}
                onClick={() => handleNotificationClick(notification)}
              >
                {notification.type === 'message' ? (
                  <div className="notification-item-avatar">
                    {notification.user?.profileImageUrl ? (
                      <img 
                        src={notification.user.profileImageUrl} 
                        alt={notification.user.name || notification.user.email || '사용자'}
                        onError={(e) => {
                          console.error('[NotificationPanel] Failed to load profile image:', notification.user?.profileImageUrl);
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.add('show');
                        }}
                        onLoad={() => {
                          console.log('[NotificationPanel] Profile image loaded successfully:', notification.user?.profileImageUrl);
                        }}
                      />
                    ) : null}
                    <div className={`notification-item-avatar-placeholder ${!notification.user?.profileImageUrl ? 'show' : ''}`}></div>
                  </div>
                ) : (
                  <div className="notification-item-icon">
                    {getNotificationIcon(notification.type)}
                  </div>
                )}
                <div className="notification-item-content">
                  <div className="notification-item-header">
                    <span className="notification-item-title">{notification.title}</span>
                    {!notification.read && <span className="notification-dot" aria-label="읽지 않음" />}
                  </div>
                  {notification.type === 'message' && notification.roomName && (
                    <div className="notification-room-info">
                      {notification.roomName}
                    </div>
                  )}
                  <p className="notification-item-message">
                    {notification.type === 'team_invite' && notification.teamName ? (
                      <>
                        <strong className="notification-team-name">"{notification.teamName}"</strong> 워크스페이스에 초대받았습니다.
                      </>
                    ) : (
                      notification.message
                    )}
                  </p>
                  {notification.type === 'team_invite' && (
                    <div className="notification-invite-actions">
                      <button
                        className="notification-invite-accept"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcceptInvite(notification);
                        }}
                      >
                        수락
                      </button>
                      <button
                        className="notification-invite-reject"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRejectInvite(notification);
                        }}
                      >
                        거절
                      </button>
                    </div>
                  )}
                  <span className="notification-item-time">
                    {formatTime(notification.createdAt)}
                  </span>
                </div>
                <button
                  className="notification-item-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeNotification(notification.id);
                  }}
                  aria-label="알림 삭제"
                >
                  ×
                </button>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

