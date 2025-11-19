'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { useTeamViewStore } from '@/stores/useTeamViewStore';
import { FriendsPanel } from '@/components/friends/FriendsPanel';
import './MainPage.css';

export function MainPage() {
  const { selectTeam, closeChannelsPanel } = useTeamViewStore();
  const [isFriendsPanelOpen, setIsFriendsPanelOpen] = useState(true);

  // 홈 페이지 진입 시 워크스페이스 선택 초기화 및 친구 패널 열기
  useEffect(() => {
    selectTeam(null);
    closeChannelsPanel();
    setIsFriendsPanelOpen(true);
  }, [selectTeam, closeChannelsPanel]);

  return (
    <>
      <div className={isFriendsPanelOpen ? 'main-content-with-friends' : ''}>
        <MainLayout headerTitle="메인화면">
          <div className="main-page-content">
            {/* Top Row - Two Cards */}
            <div className="main-page-grid">
              {/* Trending Posts Card */}
              <div className="main-card">
                <div className="main-card-header">
                  <h2 className="main-card-title">🔥 Trending Posts</h2>
                  <button className="main-card-button">View all</button>
                </div>
                <div className="main-card-content">
                  {/* Placeholder for trending posts */}
                </div>
              </div>

              {/* Event Zone Card */}
              <div className="main-card">
                <div className="main-card-header">
                  <h2 className="main-card-title">🗓️ Event Zone</h2>
                  <button className="main-card-button">🗓️ Calendar</button>
                </div>
                <div className="main-card-content">
                  {/* Placeholder for events */}
                </div>
              </div>
            </div>

            {/* Bottom Section - Recent Discussions */}
            <div className="main-card">
              <div className="main-card-header">
                <h2 className="main-card-title">💬 Recent Discussions</h2>
                <button className="main-card-button">Open board</button>
              </div>
              <div className="main-card-content">
                {/* Placeholder for discussions */}
              </div>
            </div>
          </div>
        </MainLayout>
      </div>
      
      {/* Friends Panel - 사이드바 옆에 고정 */}
      {isFriendsPanelOpen && (
        <div className="friends-panel-sidebar-attached">
          <FriendsPanel
            isOpen={true}
            onClose={() => setIsFriendsPanelOpen(false)}
          />
        </div>
      )}
    </>
  );
}

