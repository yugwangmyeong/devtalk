'use client';

import { FiClipboard } from 'react-icons/fi';
import './DashboardSection.css';

export function TasksAnnouncementsSection() {
  return (
    <div className="dashboard-section dashboard-section--tasks">
      <div className="dashboard-section-header">
        <div className="dashboard-section-heading">
          <div className="dashboard-section-icon dashboard-section-icon--tasks">
            <FiClipboard />
          </div>
          <div>
            <p className="dashboard-section-eyebrow">워크스페이스 브리핑</p>
            <h2 className="dashboard-section-title">작업 · 공지</h2>
          </div>
        </div>
        <span className="dashboard-section-chip">Soon</span>
      </div>
      <div className="dashboard-section-content">
        <div className="dashboard-placeholder">
          <p>작업과 공지를 한 곳에서 확인할 수 있도록 준비 중입니다.</p>
          <span>곧 업데이트될 예정입니다.</span>
        </div>
      </div>
    </div>
  );
}

