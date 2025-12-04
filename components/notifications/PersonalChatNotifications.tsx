'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useNotificationStore } from '@/stores/useNotificationStore';
import type { Notification } from '@/types/notification';
import { formatTime, getNotificationIcon, isPersonalChatNotification } from './notificationUtils';
import { getProfileImageUrl } from '@/lib/utils';

interface PersonalChatNotificationsProps {
  notifications: Notification[];
}

export function PersonalChatNotifications({ notifications }: PersonalChatNotificationsProps) {
  const { markAsRead, removeNotification, removeNotificationByFriendshipId, closePanel } = useNotificationStore();
  const router = useRouter();

  // 개인 채팅 알림만 필터링
  const personalNotifications = notifications.filter(isPersonalChatNotification);

  // 알림 클릭 핸들러
  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      // friend_request 알림은 클릭해도 이동하지 않음 (버튼으로 처리)
      if (notification.type === 'friend_request') {
        return;
      }

      markAsRead(notification.id);

      // 일반 채팅방 알림인 경우 해당 채팅방으로 이동 (DM 또는 개인 공간)
      if (notification.roomId) {
        router.push(`/chat?roomId=${notification.roomId}`);
        closePanel();
      }
    },
    [markAsRead, router, closePanel]
  );

  // 친구 요청 수락 핸들러
  const handleAcceptFriendRequest = useCallback(
    async (notification: Notification) => {
      if (!notification.friendshipId) {
        console.error('[PersonalChatNotifications] No friendshipId in notification:', notification);
        return;
      }

      try {
        const response = await fetch(`/api/friends/${notification.friendshipId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ action: 'ACCEPT' }),
        });

        if (response.ok) {
          // friendshipId로 알림 제거 (더 안전함)
          if (notification.friendshipId) {
            removeNotificationByFriendshipId(notification.friendshipId);
          } else {
            // fallback: ID로 제거
            markAsRead(notification.id);
            removeNotification(notification.id);
          }
          window.dispatchEvent(new CustomEvent('friendsUpdated'));
        } else {
          const errorData = await response.json();
          alert(errorData.error || '친구 요청 수락에 실패했습니다.');
        }
      } catch (error) {
        console.error('[PersonalChatNotifications] Failed to accept friend request:', error);
        alert('친구 요청 수락에 실패했습니다.');
      }
    },
    [markAsRead, removeNotification, removeNotificationByFriendshipId]
  );

  // 친구 요청 거절 핸들러
  const handleRejectFriendRequest = useCallback(
    async (notification: Notification) => {
      if (!notification.friendshipId) {
        console.error('[PersonalChatNotifications] No friendshipId in notification:', notification);
        return;
      }

      try {
        const response = await fetch(`/api/friends/${notification.friendshipId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ action: 'DECLINE' }),
        });

        if (response.ok) {
          // friendshipId로 알림 제거 (더 안전함)
          if (notification.friendshipId) {
            removeNotificationByFriendshipId(notification.friendshipId);
          } else {
            // fallback: ID로 제거
            markAsRead(notification.id);
            removeNotification(notification.id);
          }
          window.dispatchEvent(new CustomEvent('friendsUpdated'));
        } else {
          const errorData = await response.json();
          alert(errorData.error || '친구 요청 거절에 실패했습니다.');
        }
      } catch (error) {
        console.error('[PersonalChatNotifications] Failed to reject friend request:', error);
        alert('친구 요청 거절에 실패했습니다.');
      }
    },
    [markAsRead, removeNotification, removeNotificationByFriendshipId]
  );

  if (personalNotifications.length === 0) {
    return (
      <div className="notification-empty">
        <p>개인 채팅 알림이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="notification-list">
      {personalNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification-item ${!notification.read ? 'unread' : ''} ${notification.type === 'friend_request' ? 'notification-item-invite' : ''}`}
          onClick={() => handleNotificationClick(notification)}
        >
          {notification.type === 'message' || notification.type === 'friend_request' ? (
            <div className="notification-item-avatar">
              <img 
                src={getProfileImageUrl(notification.user?.profileImageUrl)} 
                alt={notification.user?.name || notification.user?.email || '사용자'}
                onError={(e) => {
                  console.error('[PersonalChatNotifications] Failed to load profile image:', notification.user?.profileImageUrl);
                }}
              />
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
              {notification.message}
            </p>
            {notification.type === 'friend_request' && (
              <div className="notification-invite-actions">
                <button
                  className="notification-invite-accept"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAcceptFriendRequest(notification);
                  }}
                >
                  수락
                </button>
                <button
                  className="notification-invite-reject"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRejectFriendRequest(notification);
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
      ))}
    </div>
  );
}

