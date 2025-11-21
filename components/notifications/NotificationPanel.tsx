'use client';

import { useEffect, useRef, useState } from 'react';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { TeamWorkspaceNotifications } from './TeamWorkspaceNotifications';
import { PersonalChatNotifications } from './PersonalChatNotifications';
import { isTeamWorkspaceNotification, isPersonalChatNotification } from './notificationUtils';
import type { Notification } from '@/types/notification';
import './NotificationPanel.css';

type TabType = 'all' | 'workspace' | 'personal';

export function NotificationPanel() {
  const {
    notifications,
    unreadCount,
    isOpen,
    markAllAsRead,
    closePanel,
  } = useNotificationStore();
  const [activeTab, setActiveTab] = useState<TabType>('all');
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

  // 탭별 알림 필터링
  const getFilteredNotifications = (): Notification[] => {
    switch (activeTab) {
      case 'workspace':
        return notifications.filter(isTeamWorkspaceNotification);
      case 'personal':
        return notifications.filter(isPersonalChatNotification);
      default:
        return notifications;
    }
  };

  // 탭별 읽지 않은 알림 개수 계산
  const getUnreadCountByTab = (tab: TabType): number => {
    let filtered: Notification[];
    switch (tab) {
      case 'workspace':
        filtered = notifications.filter(isTeamWorkspaceNotification);
        break;
      case 'personal':
        filtered = notifications.filter(isPersonalChatNotification);
        break;
      default:
        filtered = notifications;
    }
    return filtered.filter(n => !n.read).length;
  };

  if (!isOpen) return null;

  const filteredNotifications = getFilteredNotifications();
  const teamUnreadCount = getUnreadCountByTab('workspace');
  const personalUnreadCount = getUnreadCountByTab('personal');

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

      {/* 탭 네비게이션 */}
      <div className="notification-tabs">
        <button
          className={`notification-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          전체
          {unreadCount > 0 && <span className="notification-tab-badge">{unreadCount}</span>}
        </button>
        <button
          className={`notification-tab ${activeTab === 'workspace' ? 'active' : ''}`}
          onClick={() => setActiveTab('workspace')}
        >
          워크스페이스
          {teamUnreadCount > 0 && <span className="notification-tab-badge">{teamUnreadCount}</span>}
        </button>
        <button
          className={`notification-tab ${activeTab === 'personal' ? 'active' : ''}`}
          onClick={() => setActiveTab('personal')}
        >
          개인 채팅
          {personalUnreadCount > 0 && <span className="notification-tab-badge">{personalUnreadCount}</span>}
        </button>
      </div>

      <div className="notification-panel-content">
        {filteredNotifications.length === 0 ? (
          <div className="notification-empty">
            <p>
              {activeTab === 'all' && '알림이 없습니다'}
              {activeTab === 'workspace' && '워크스페이스 알림이 없습니다'}
              {activeTab === 'personal' && '개인 채팅 알림이 없습니다'}
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'all' && (
              <>
                {notifications.filter(isTeamWorkspaceNotification).length > 0 && (
                  <div className="notification-section">
                    <div className="notification-section-header">
                      <span className="notification-section-title">워크스페이스</span>
                    </div>
                    <TeamWorkspaceNotifications notifications={notifications} />
                  </div>
                )}
                {notifications.filter(isPersonalChatNotification).length > 0 && (
                  <div className="notification-section">
                    <div className="notification-section-header">
                      <span className="notification-section-title">개인 채팅</span>
                    </div>
                    <PersonalChatNotifications notifications={notifications} />
                  </div>
                )}
              </>
            )}
            {activeTab === 'workspace' && (
              <TeamWorkspaceNotifications notifications={notifications} />
            )}
            {activeTab === 'personal' && (
              <PersonalChatNotifications notifications={notifications} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

