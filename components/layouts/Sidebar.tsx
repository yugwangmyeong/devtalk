'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useTeamViewStore } from '@/stores/useTeamViewStore';
import { ProfileEditModal } from './ProfileEditModal';
import { NotificationPanel } from '@/components/notifications/NotificationPanel';
import { TeamPanel } from '@/components/teams/TeamPanel';
import { TeamChannelsPanel } from '@/components/teams/TeamChannelsPanel';
import './css/MainLayout.css';

export function Sidebar() {
  const router = useRouter();
  const { logout, user } = useAuthStore();
  const { unreadCount, togglePanel } = useNotificationStore();
  const { 
    isOpen: isTeamPanelOpen, 
    isChannelsPanelOpen,
    toggleTeamView, 
    closeTeamView,
    toggleChannelsPanel,
    closeChannelsPanel,
    selectedTeam
  } = useTeamViewStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 프로필 이미지 URL 확인 및 정규화
  const profileImageUrl = user?.profileImageUrl?.trim() || null;

  // 디버깅: 프로필 이미지 URL 확인
  useEffect(() => {
    if (user) {
      console.log('User profileImageUrl:', user.profileImageUrl);
      console.log('Normalized profileImageUrl:', profileImageUrl);
    }
  }, [user, profileImageUrl]);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
    router.refresh();
  };

  return (
    <>
      <aside className="main-sidebar">
      {/* Team Button */}
      <button 
        className={`main-team-button ${selectedTeam ? 'main-team-button-active' : ''}`}
        disabled={!!selectedTeam}
        onClick={() => {
          if (selectedTeam) {
            // 워크스페이스가 선택되어 있으면 채널 패널 토글
            toggleChannelsPanel();
          } else {
            // 워크스페이스가 없으면 워크스페이스 페이지로 이동
            router.push('/teams');
          }
        }}
      >
        {selectedTeam ? selectedTeam.name[0]?.toUpperCase() || '팀' : '팀'}
      </button>

      {/* Navigation */}
      <nav className="main-nav">
        <button
          className="main-nav-button"
          onClick={() => router.push('/')}
        >
          <svg className="main-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="main-nav-text">HOME</span>
        </button>

        <button
          className="main-nav-button"
          onClick={() => router.push('/chat')}
        >
          <svg className="main-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="main-nav-text">CHAT</span>
        </button>

      </nav>

      {/* Bottom Actions */}
      <div className="main-bottom-actions" ref={menuRef}>
        <button 
          className="main-nav-button notification-button"
          onClick={togglePanel}
        >
          <div className="notification-button-wrapper">
            <svg className="main-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="notification-badge">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <span className="main-nav-text">Alarm</span>
        </button>
        <button className="main-settings-button">
          <svg className="main-settings-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <div className="main-bottom-menu-wrapper">
          <button
            className="main-bottom-button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {profileImageUrl && !imageError ? (
              <img
                key={profileImageUrl}
                src={profileImageUrl}
                alt={user?.name || user?.email || 'Profile'}
                className="main-bottom-button-image"
                onError={() => setImageError(true)}
                onLoad={() => setImageError(false)}
              />
            ) : (
              <div className="main-bottom-button-placeholder">
                {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
          </button>
          {isMenuOpen && (
            <div className="main-bottom-menu">
              <button
                className="main-bottom-menu-item"
                onClick={() => {
                  setIsProfileModalOpen(true);
                  setIsMenuOpen(false);
                }}
              >
                회원정보수정
              </button>
              <button
                className="main-bottom-menu-item"
                onClick={handleLogout}
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Edit Modal */}
      <ProfileEditModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* Notification Panel */}
      <NotificationPanel />

        {/* Team Panel */}
        <TeamPanel 
          isOpen={isTeamPanelOpen}
          onClose={closeTeamView}
        />
      </aside>

      {/* Team Channels Panel */}
      <TeamChannelsPanel 
        isOpen={isChannelsPanelOpen}
        onClose={closeChannelsPanel}
      />
    </>
  );
}

