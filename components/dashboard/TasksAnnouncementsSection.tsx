'use client';

import { FiClipboard } from 'react-icons/fi';
import { HiSpeakerphone } from 'react-icons/hi';
import './DashboardSection.css';

interface Announcement {
  id: string;
  content: string;
  team: {
    id: string;
    name: string;
    iconUrl: string | null;
  } | null;
  author: {
    id: string;
    email: string;
    name: string | null;
    profileImageUrl: string | null;
  };
  createdAt: string;
}

interface TasksAnnouncementsSectionProps {
  announcements?: Announcement[];
  isLoading?: boolean;
}

export function TasksAnnouncementsSection({ 
  announcements = [], 
  isLoading = false 
}: TasksAnnouncementsSectionProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return diffMins <= 1 ? '방금 전' : `${diffMins}분 전`;
      }
      return `${diffHours}시간 전`;
    } else if (diffDays === 1) {
      return '어제';
    } else if (diffDays < 7) {
      return `${diffDays}일 전`;
    } else {
      return new Intl.DateTimeFormat('ko-KR', {
        month: 'short',
        day: 'numeric',
      }).format(date);
    }
  };

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
        {announcements.length > 0 && (
          <span className="dashboard-section-chip">{announcements.length}</span>
        )}
      </div>
      <div className="dashboard-section-content">
        {isLoading ? (
          <div className="dashboard-loading">공지를 불러오는 중...</div>
        ) : announcements.length === 0 ? (
          <div className="dashboard-placeholder">
            <p>아직 공지가 없습니다.</p>
            <span>팀에서 공지를 올리면 여기에 표시됩니다.</span>
          </div>
        ) : (
          <div className="dashboard-announcements-list">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="dashboard-announcement-item">
                <div className="dashboard-announcement-header">
                  <div className="dashboard-announcement-meta">
                    <div className="dashboard-announcement-icon">
                      <HiSpeakerphone />
                    </div>
                    <div className="dashboard-announcement-info">
                      <div className="dashboard-announcement-author">
                        {announcement.author.profileImageUrl ? (
                          <img
                            src={announcement.author.profileImageUrl}
                            alt={announcement.author.name || announcement.author.email}
                            className="dashboard-announcement-avatar"
                          />
                        ) : (
                          <div className="dashboard-announcement-avatar dashboard-announcement-avatar--default">
                            {(announcement.author.name || announcement.author.email || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <span className="dashboard-announcement-author-name">
                          {announcement.author.name || announcement.author.email}
                        </span>
                        {announcement.team && (
                          <>
                            <span className="dashboard-announcement-separator">•</span>
                            <span className="dashboard-announcement-team">
                              {announcement.team.name}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="dashboard-announcement-time">
                        {formatDate(announcement.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="dashboard-announcement-content">
                  {announcement.content.split('\n').map((line, idx) => (
                    <p key={idx} className="dashboard-announcement-text">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

