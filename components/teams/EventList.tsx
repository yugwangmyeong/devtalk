'use client';

import { useState, useEffect, useCallback } from 'react';
import { EventCard, type Event } from './EventCard';
import './EventList.css';

interface EventListProps {
  teamId: string;
}

export function EventList({ teamId }: EventListProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState('');

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/teams/${teamId}/events`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '이벤트 목록을 가져오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
      setError('이벤트 목록을 가져오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // 전역 이벤트 구독 (다른 컴포넌트에서 이벤트 생성/업데이트 시 자동 업데이트)
  useEffect(() => {
    const handleEventCreated = (event: CustomEvent) => {
      if (event.detail?.teamId === teamId) {
        fetchEvents();
      }
    };

    const handleEventUpdated = (event: CustomEvent) => {
      if (event.detail?.teamId === teamId) {
        fetchEvents();
      }
    };

    window.addEventListener('eventCreated', handleEventCreated as EventListener);
    window.addEventListener('eventUpdated', handleEventUpdated as EventListener);
    return () => {
      window.removeEventListener('eventCreated', handleEventCreated as EventListener);
      window.removeEventListener('eventUpdated', handleEventUpdated as EventListener);
    };
  }, [teamId, fetchEvents]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('이벤트 제목을 입력해주세요.');
      return;
    }

    if (!startDate || !endDate) {
      alert('시작일과 종료일을 입력해주세요.');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch(`/api/teams/${teamId}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          startDate,
          endDate,
          allDay,
          location: location.trim() || null,
        }),
      });

      if (response.ok) {
        // Reset form
        setTitle('');
        setDescription('');
        setStartDate('');
        setEndDate('');
        setAllDay(false);
        setLocation('');
        setShowCreateForm(false);
        // Refresh events
        await fetchEvents();
        // 전역 이벤트 발생 (다른 컴포넌트들이 구독할 수 있도록)
        window.dispatchEvent(new CustomEvent('eventCreated', { detail: { teamId } }));
      } else {
        const errorData = await response.json();
        alert(errorData.error || '이벤트 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to create event:', error);
      alert('이벤트 생성에 실패했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  // Format date for input (YYYY-MM-DDTHH:mm)
  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Set default dates
  useEffect(() => {
    if (!startDate) {
      const now = new Date();
      setStartDate(formatDateForInput(now));
      const end = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
      setEndDate(formatDateForInput(end));
    }
  }, []);

  const upcomingEvents = events.filter(
    (event) => new Date(event.endDate) >= new Date()
  );
  const pastEvents = events.filter(
    (event) => new Date(event.endDate) < new Date()
  );

  return (
    <div className="event-list-container">
      <div className="event-list-header">
        <h2 className="event-list-title">📅 캘린더 이벤트</h2>
        <button
          className="event-create-btn"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? '취소' : '+ 이벤트 만들기'}
        </button>
      </div>

      <div className="event-list-scrollable">
        {showCreateForm && (
          <form className="event-create-form" onSubmit={handleCreateEvent}>
          <div className="event-form-group">
            <label className="event-form-label">제목 *</label>
            <input
              type="text"
              className="event-form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 리액트 스터디 모임"
              required
            />
          </div>

          <div className="event-form-group">
            <label className="event-form-label">설명</label>
            <textarea
              className="event-form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이벤트 설명을 입력하세요"
              rows={3}
            />
          </div>

          <div className="event-form-row">
            <div className="event-form-group">
              <label className="event-form-label">시작일시 *</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                className="event-form-input"
                value={allDay ? startDate.split('T')[0] : startDate}
                onChange={(e) => {
                  if (allDay) {
                    setStartDate(e.target.value + 'T00:00');
                  } else {
                    setStartDate(e.target.value);
                  }
                }}
                required
              />
            </div>

            <div className="event-form-group">
              <label className="event-form-label">종료일시 *</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                className="event-form-input"
                value={allDay ? endDate.split('T')[0] : endDate}
                onChange={(e) => {
                  if (allDay) {
                    setEndDate(e.target.value + 'T23:59');
                  } else {
                    setEndDate(e.target.value);
                  }
                }}
                required
              />
            </div>
          </div>

          <div className="event-form-group">
            <label className="event-form-checkbox-label">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
              />
              <span>종일 이벤트</span>
            </label>
          </div>

          <div className="event-form-group">
            <label className="event-form-label">장소</label>
            <input
              type="text"
              className="event-form-input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="예: 온라인, 회의실 A"
            />
          </div>

          <div className="event-form-actions">
            <button
              type="button"
              className="event-form-cancel-btn"
              onClick={() => setShowCreateForm(false)}
            >
              취소
            </button>
            <button
              type="submit"
              className="event-form-submit-btn"
              disabled={isCreating}
            >
              {isCreating ? '생성 중...' : '이벤트 만들기'}
            </button>
          </div>
        </form>
        )}

        {isLoading ? (
        <div className="event-list-loading">이벤트를 불러오는 중...</div>
      ) : error ? (
        <div className="event-list-error">{error}</div>
      ) : (
        <>
          {upcomingEvents.length > 0 && (
            <div className="event-list-section">
              <h3 className="event-list-section-title">예정된 이벤트</h3>
              {upcomingEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  teamId={teamId}
                  onStatusChange={fetchEvents}
                />
              ))}
            </div>
          )}

          {pastEvents.length > 0 && (
            <div className="event-list-section">
              <h3 className="event-list-section-title">지난 이벤트</h3>
              {pastEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  teamId={teamId}
                  onStatusChange={fetchEvents}
                />
              ))}
            </div>
          )}

          {events.length === 0 && (
            <div className="event-list-empty">
              아직 등록된 이벤트가 없습니다.
              <br />
              위의 "이벤트 만들기" 버튼을 눌러 첫 이벤트를 만들어보세요!
            </div>
          )}
        </>
        )}
      </div>
    </div>
  );
}

