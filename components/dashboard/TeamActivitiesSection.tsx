'use client';

import { useRouter } from 'next/navigation';
import { FiActivity, FiCalendar, FiHash, FiUserPlus } from 'react-icons/fi';
import './DashboardSection.css';

interface TeamActivity {
  type: 'event' | 'channel' | 'member';
  id: string;
  team: {
    id: string;
    name: string;
    iconUrl: string | null;
  };
  user?: {
    id: string;
    email: string;
    name: string | null;
    profileImageUrl: string | null;
  };
  title: string;
  createdAt: string;
}

interface TeamActivitiesSectionProps {
  activities: TeamActivity[];
  isLoading: boolean;
}

export function TeamActivitiesSection({ activities, isLoading }: TeamActivitiesSectionProps) {
  const router = useRouter();

  const formatTimeAgo = (dateString: string) => {
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
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const activityIconMap: Record<TeamActivity['type'], React.ReactNode> = {
    event: <FiCalendar size={18} />,
    channel: <FiHash size={18} />,
    member: <FiUserPlus size={18} />,
  };

  const getActivityText = (activity: TeamActivity) => {
    switch (activity.type) {
      case 'event':
        return `${activity.user?.name || activity.user?.email || '누군가'}가 이벤트를 생성했습니다`;
      case 'channel':
        return `채널 "${activity.title}"이 생성되었습니다`;
      case 'member':
        return activity.title;
      default:
        return activity.title;
    }
  };

  return (
    <div className="dashboard-section dashboard-section--activities">
      <div className="dashboard-section-header">
        <div className="dashboard-section-heading">
          <div className="dashboard-section-icon dashboard-section-icon--activity">
            <FiActivity />
          </div>
          <div>
            <p className="dashboard-section-eyebrow">최근 30일</p>
            <h2 className="dashboard-section-title">팀 활동 히스토리</h2>
          </div>
        </div>
      </div>
      <div className="dashboard-section-content">
        {isLoading ? (
          <div className="dashboard-loading">로딩 중...</div>
        ) : activities.length === 0 ? (
          <div className="dashboard-empty">최근 활동이 없습니다</div>
        ) : (
          <div className="dashboard-activities-list">
            {activities.slice(0, 8).map((activity) => (
              <div
                key={activity.id}
                className="dashboard-activity-item"
                onClick={() => router.push(`/teams?teamId=${activity.team.id}`)}
              >
                <div className="dashboard-activity-icon">
                  {activityIconMap[activity.type]}
                </div>
                <div className="dashboard-activity-content">
                  <div className="dashboard-activity-text">
                    <span className="dashboard-activity-team">{activity.team.name}</span>
                    <span className="dashboard-activity-action">{getActivityText(activity)}</span>
                  </div>
                  <div className="dashboard-activity-time">
                    {formatTimeAgo(activity.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

