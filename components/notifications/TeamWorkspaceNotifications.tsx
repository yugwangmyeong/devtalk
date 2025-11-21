'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useNotificationStore } from '@/stores/useNotificationStore';
import type { Notification } from '@/types/notification';
import { formatTime, getNotificationIcon, isTeamWorkspaceNotification } from './notificationUtils';

interface TeamWorkspaceNotificationsProps {
  notifications: Notification[];
}

export function TeamWorkspaceNotifications({ notifications }: TeamWorkspaceNotificationsProps) {
  const { markAsRead, removeNotification, closePanel } = useNotificationStore();
  const router = useRouter();

  // 팀 워크스페이스 알림만 필터링
  const teamNotifications = notifications.filter(isTeamWorkspaceNotification);

  // 알림 클릭 핸들러
  const handleNotificationClick = useCallback(
    (notification: Notification) => {
      // team_invite 알림은 클릭해도 이동하지 않음 (버튼으로 처리)
      if (notification.type === 'team_invite') {
        return;
      }

      markAsRead(notification.id);

      // 워크스페이스 채널 알림인 경우 TeamsPage로 이동
      if (notification.teamId && notification.channelId) {
        router.push(`/teams?teamId=${notification.teamId}&channelId=${notification.channelId}`);
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

  if (teamNotifications.length === 0) {
    return (
      <div className="notification-empty">
        <p>워크스페이스 알림이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="notification-list">
      {teamNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification-item ${!notification.read ? 'unread' : ''} ${notification.type === 'team_invite' ? 'notification-item-invite' : ''}`}
          onClick={() => handleNotificationClick(notification)}
        >
          <div className="notification-item-icon">
            {notification.teamId ? (
              <span className="team-channels-team-icon">
                {notification.teamName ? notification.teamName[0]?.toUpperCase() || 'T' : 'T'}
              </span>
            ) : (
              getNotificationIcon(notification.type)
            )}
          </div>
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
                  <strong className="notification-team-name">&ldquo;{notification.teamName}&rdquo;</strong> 워크스페이스에 초대받았습니다.
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
      ))}
    </div>
  );
}

