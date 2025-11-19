'use client';

import { useRouter } from 'next/navigation';
import { FiCalendar, FiChevronRight } from 'react-icons/fi';
import './DashboardSection.css';

interface EventItem {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location: string | null;
  teamId: string;
  team: {
    id: string;
    name: string;
    iconUrl: string | null;
  };
  creator: {
    id: string;
    email: string;
    name: string | null;
    profileImageUrl: string | null;
  };
  myStatus: string | null;
}

interface UpcomingEventsSectionProps {
  events: EventItem[];
  isLoading: boolean;
}

export function UpcomingEventsSection({ events, isLoading }: UpcomingEventsSectionProps) {
  const router = useRouter();

  const formatDate = (dateString: string, allDay: boolean) => {
    const date = new Date(dateString);
    if (allDay) {
      return date.toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric',
      });
    }
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: string | null) => {
    if (!status) return null;
    switch (status) {
      case 'ACCEPTED':
        return '✓';
      case 'DECLINED':
        return '✗';
      case 'TENTATIVE':
        return '?';
      default:
        return null;
    }
  };

  return (
    <div className="dashboard-section dashboard-section--events">
      <div className="dashboard-section-header">
        <div className="dashboard-section-heading">
          <div className="dashboard-section-icon dashboard-section-icon--calendar">
            <FiCalendar />
          </div>
          <div>
            <p className="dashboard-section-eyebrow">다음 2주 일정</p>
            <h2 className="dashboard-section-title">팀 일정 요약</h2>
          </div>
        </div>
        <button
          className="dashboard-section-button"
          onClick={() => router.push('/teams')}
        >
          일정 관리
          <FiChevronRight />
        </button>
      </div>
      <div className="dashboard-section-content">
        {isLoading ? (
          <div className="dashboard-loading">로딩 중...</div>
        ) : events.length === 0 ? (
          <div className="dashboard-empty">다가오는 일정이 없습니다</div>
        ) : (
          <div className="dashboard-events-list">
            {events.slice(0, 5).map((event) => (
              <div
                key={event.id}
                className="dashboard-event-item"
                onClick={() => router.push(`/teams?teamId=${event.teamId}&tab=events`)}
              >
                <div className="dashboard-event-content">
                  <div className="dashboard-event-title">{event.title}</div>
                  <div className="dashboard-event-desc">
                    {event.description || '설명이 없습니다'}
                  </div>
                  <div className="dashboard-event-meta">
                    <span className="dashboard-event-team">{event.team.name}</span>
                    <span className="dashboard-event-date">
                      {formatDate(event.startDate, event.allDay)}
                    </span>
                  </div>
                </div>
                {event.myStatus && (
                  <div className={`dashboard-event-status dashboard-event-status--${event.myStatus.toLowerCase()}`}>
                    {getStatusIcon(event.myStatus)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

