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
      markAsRead(notification.id);

      // 채팅방 알림인 경우 해당 채팅방으로 이동
      if (notification.roomId) {
        router.push(`/chat?roomId=${notification.roomId}`);
        closePanel();
      }
    },
    [markAsRead, router, closePanel]
  );

  // 시간 포맷팅 헬퍼 함수
  const formatTime = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString('ko-KR');
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
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`notification-item ${!notification.read ? 'unread' : ''}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="notification-item-icon">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="notification-item-content">
                  <div className="notification-item-header">
                    <span className="notification-item-title">{notification.title}</span>
                    {!notification.read && <span className="notification-dot" aria-label="읽지 않음" />}
                  </div>
                  <p className="notification-item-message">{notification.message}</p>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

