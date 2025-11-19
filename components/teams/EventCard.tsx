'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { HiCalendar, HiLocationMarker, HiUsers, HiCheckCircle, HiXCircle, HiQuestionMarkCircle, HiClock } from 'react-icons/hi';
import './EventCard.css';

export interface Event {
  id: string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location?: string | null;
  teamId: string;
  creator: {
    id: string;
    email: string;
    name: string | null;
    profileImageUrl: string | null;
  };
  createdAt: string;
  updatedAt: string;
  myStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | null;
  attendees: Array<{
    id: string;
    userId: string;
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';
    user: {
      id: string;
      email: string;
      name: string | null;
      profileImageUrl: string | null;
    };
    createdAt: string;
  }>;
  attendeeCount: number;
  acceptedCount: number;
}

interface EventCardProps {
  event: Event;
  teamId: string;
  onStatusChange?: () => void;
}

export function EventCard({ event, teamId, onStatusChange }: EventCardProps) {
  const { user } = useAuthStore;
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(event.myStatus);

  const formatDate = (dateString: string, allDay: boolean) => {
    const date = new Date(dateString);
    if (allDay) {
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTimeRange = () => {
    if (event.allDay) {
      const start = formatDate(event.startDate, true);
      const end = formatDate(event.endDate, true);
      if (start === end) {
        return start;
      }
      return `${start} ~ ${end}`;
    }
    const start = formatDate(event.startDate, false);
    const end = formatDate(event.endDate, false);
    return `${start} ~ ${end}`;
  };

  const handleStatusChange = async (newStatus: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE') => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      const response = await fetch(
        `/api/teams/${teamId}/events/${event.id}/attend`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (response.ok) {
        setCurrentStatus(newStatus);
        if (onStatusChange) {
          onStatusChange();
        }
        // 전역 이벤트 발생 (다른 컴포넌트들이 구독할 수 있도록)
        window.dispatchEvent(new CustomEvent('eventUpdated', { detail: { teamId, eventId: event.id } }));
      } else {
        const errorData = await response.json();
        alert(errorData.error || '참석 상태 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to update attendance status:', error);
      alert('참석 상태 변경에 실패했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusButtonClass = (status: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE') => {
    const baseClass = 'event-status-btn';
    if (currentStatus === status) {
      return `${baseClass} ${baseClass}--active ${baseClass}--${status.toLowerCase()}`;
    }
    return baseClass;
  };

  return (
    <div className="event-card">
      <div className="event-card-header">
        <h3 className="event-card-title">{event.title}</h3>
        {event.creator.id === user?.id && (
          <span className="event-card-creator-badge">내가 만든 이벤트</span>
        )}
      </div>

      {event.description && (
        <p className="event-card-description">{event.description}</p>
      )}

      <div className="event-card-info">
        <div className="event-card-info-item">
          <span className="event-card-info-label">
            <HiCalendar className="event-card-info-icon" />
            일시:
          </span>
          <span className="event-card-info-value">{formatTimeRange()}</span>
        </div>
        {event.location && (
          <div className="event-card-info-item">
            <span className="event-card-info-label">
              <HiLocationMarker className="event-card-info-icon" />
              장소:
            </span>
            <span className="event-card-info-value">{event.location}</span>
          </div>
        )}
        <div className="event-card-info-item">
          <span className="event-card-info-label">
            <HiUsers className="event-card-info-icon" />
            참석자:
          </span>
          <span className="event-card-info-value">
            {event.acceptedCount}명 참석 / {event.attendeeCount}명 초대됨
          </span>
        </div>
      </div>

      <div className="event-card-actions">
        <button
          className={getStatusButtonClass('ACCEPTED')}
          onClick={() => handleStatusChange('ACCEPTED')}
          disabled={isUpdating}
        >
          <HiCheckCircle className="event-status-icon" />
          참석
        </button>
        <button
          className={getStatusButtonClass('TENTATIVE')}
          onClick={() => handleStatusChange('TENTATIVE')}
          disabled={isUpdating}
        >
          <HiQuestionMarkCircle className="event-status-icon" />
          불확실
        </button>
        <button
          className={getStatusButtonClass('DECLINED')}
          onClick={() => handleStatusChange('DECLINED')}
          disabled={isUpdating}
        >
          <HiXCircle className="event-status-icon" />
          불참
        </button>
      </div>

      {currentStatus && (
        <div className="event-card-status">
          <span className={`event-card-status-badge event-card-status-badge--${currentStatus.toLowerCase()}`}>
            {currentStatus === 'ACCEPTED' && (
              <>
                <HiCheckCircle className="event-status-badge-icon" />
                참석 예정
              </>
            )}
            {currentStatus === 'TENTATIVE' && (
              <>
                <HiQuestionMarkCircle className="event-status-badge-icon" />
                불확실
              </>
            )}
            {currentStatus === 'DECLINED' && (
              <>
                <HiXCircle className="event-status-badge-icon" />
                불참
              </>
            )}
            {currentStatus === 'PENDING' && (
              <>
                <HiClock className="event-status-badge-icon" />
                대기 중
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

