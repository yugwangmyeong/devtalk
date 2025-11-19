'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Event } from './EventCard';
import { CalendarModal } from './CalendarModal';
import { EventDetailModal } from './EventDetailModal';
import './TeamEventsSection.css';

interface TeamEventsSectionProps {
  teamId: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function TeamEventsSection({ teamId, isExpanded, onToggleExpand }: TeamEventsSectionProps) {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isEventDetailModalOpen, setIsEventDetailModalOpen] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!teamId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/teams/${teamId}/events`);
      if (response.ok) {
        const data = await response.json();
        // 최근 5개만 표시
        const upcomingEvents = (data.events || [])
          .filter((e: Event) => new Date(e.endDate) >= new Date())
          .slice(0, 5);
        setEvents(upcomingEvents);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '이벤트를 가져오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
      setError('이벤트를 가져오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (isExpanded) {
      fetchEvents();
    }
  }, [isExpanded, fetchEvents]);

  // 전역 이벤트 구독 (다른 컴포넌트에서 이벤트 생성/업데이트 시 자동 업데이트)
  useEffect(() => {
    const handleEventCreated = (event: CustomEvent) => {
      if (event.detail?.teamId === teamId && isExpanded) {
        fetchEvents();
      }
    };

    const handleEventUpdated = (event: CustomEvent) => {
      if (event.detail?.teamId === teamId && isExpanded) {
        fetchEvents();
      }
    };

    window.addEventListener('eventCreated', handleEventCreated as EventListener);
    window.addEventListener('eventUpdated', handleEventUpdated as EventListener);
    return () => {
      window.removeEventListener('eventCreated', handleEventCreated as EventListener);
      window.removeEventListener('eventUpdated', handleEventUpdated as EventListener);
    };
  }, [teamId, isExpanded, fetchEvents]);

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

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setIsEventDetailModalOpen(true);
  };

  return (
    <div className="team-events-section">
      <div 
        className="team-events-section-header"
        onClick={onToggleExpand}
      >
        <span className="team-events-section-title">이벤트</span>
        <svg 
          className={`team-events-expand-icon ${isExpanded ? 'expanded' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isExpanded && (
        <>
          <div className="team-events-calendar-button-wrapper">
            <button
              className="team-events-calendar-button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCalendarModalOpen(true);
              }}
            >
              <svg className="team-events-calendar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>캘린더</span>
            </button>
          </div>
        </>
      )}

      {isExpanded && (
        <div className="team-events-list">
          {isLoading ? (
            <div className="team-events-loading">로딩 중...</div>
          ) : error ? (
            <div className="team-events-error">{error}</div>
          ) : events.length === 0 ? (
            <div className="team-events-empty">예정된 이벤트가 없습니다</div>
          ) : (
            <>
              {events.map((event) => (
                <div
                  key={event.id}
                  className="team-events-item"
                  onClick={() => handleEventClick(event)}
                >
                  <div className="team-events-item-content">
                    <div className="team-events-item-title">{event.title}</div>
                    <div className="team-events-item-date">
                      {formatDate(event.startDate, event.allDay)}
                    </div>
                  </div>
                  {event.myStatus && (
                    <div className={`team-events-item-status team-events-item-status--${event.myStatus.toLowerCase()}`}>
                      {event.myStatus === 'ACCEPTED' && '✓'}
                      {event.myStatus === 'DECLINED' && '✗'}
                      {event.myStatus === 'TENTATIVE' && '?'}
                    </div>
                  )}
                </div>
              ))}
              {events.length >= 5 && (
                <div 
                  className="team-events-view-all"
                  onClick={() => router.push(`/teams?teamId=${teamId}&tab=events`)}
                >
                  모든 이벤트 보기 →
                </div>
              )}
            </>
          )}
        </div>
      )}

      <CalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        teamId={teamId}
      />

      <EventDetailModal
        isOpen={isEventDetailModalOpen}
        event={selectedEvent}
        teamId={teamId}
        onClose={() => {
          setIsEventDetailModalOpen(false);
          setSelectedEvent(null);
        }}
        onStatusChange={fetchEvents}
      />
    </div>
  );
}

