'use client';

import { MainLayout } from '@/components/layouts/MainLayout';

export function MainPage() {
  return (
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
  );
}

