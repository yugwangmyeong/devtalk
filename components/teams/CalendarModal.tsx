'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTeamViewStore } from '@/stores/useTeamViewStore';
import { useAuthStore } from '@/stores/useAuthStore';
import type { Event } from './EventCard';
import { EventCard } from './EventCard';
import { HiCheckCircle, HiXCircle, HiQuestionMarkCircle, HiClock, HiCalendar } from 'react-icons/hi';
import './CalendarModal.css';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  onEventCreated?: () => void; // 이벤트 생성 후 콜백
}

export function CalendarModal({ isOpen, onClose, teamId, onEventCreated }: CalendarModalProps) {
  const { user } = useAuthStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!teamId) {
      setEvents([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // 현재 월의 시작일과 종료일 계산
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);

      const response = await fetch(
        `/api/teams/${teamId}/events?startDate=${startOfMonth.toISOString()}&endDate=${endOfMonth.toISOString()}`
      );
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
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
  }, [teamId, currentDate]);

  useEffect(() => {
    if (isOpen && teamId) {
      fetchEvents();
    }
  }, [isOpen, teamId, fetchEvents]);

  // 전역 이벤트 구독 (다른 컴포넌트에서 이벤트 생성/업데이트 시 자동 업데이트)
  useEffect(() => {
    const handleEventCreated = (event: CustomEvent) => {
      if (event.detail?.teamId === teamId && isOpen) {
        fetchEvents();
      }
    };

    const handleEventUpdated = (event: CustomEvent) => {
      if (event.detail?.teamId === teamId && isOpen) {
        fetchEvents();
      }
    };

    window.addEventListener('eventCreated', handleEventCreated as EventListener);
    window.addEventListener('eventUpdated', handleEventUpdated as EventListener);
    return () => {
      window.removeEventListener('eventCreated', handleEventCreated as EventListener);
      window.removeEventListener('eventUpdated', handleEventUpdated as EventListener);
    };
  }, [teamId, isOpen, fetchEvents]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!teamId || !title.trim()) {
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
        setTitle('');
        setDescription('');
        setStartDate('');
        setEndDate('');
        setAllDay(false);
        setLocation('');
        setShowCreateForm(false);
        await fetchEvents();
        // 다른 컴포넌트에 이벤트 생성 알림
        if (onEventCreated) {
          onEventCreated();
        }
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

  // 캘린더 렌더링
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // 이전 달의 마지막 날들
    const prevMonth = new Date(year, month - 1, 0);
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonth.getDate() - i),
        isCurrentMonth: false,
      });
    }

    // 현재 달의 날들
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // 다음 달의 첫 날들 (캘린더를 6주로 채우기)
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => {
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);
      eventStart.setHours(0, 0, 0, 0);
      eventEnd.setHours(0, 0, 0, 0);
      return checkDate >= eventStart && checkDate <= eventEnd;
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    if (!showCreateForm) {
      const dateStr = formatDateForInput(date);
      setStartDate(dateStr);
      const endDateObj = new Date(date);
      endDateObj.setHours(date.getHours() + 1);
      setEndDate(formatDateForInput(endDateObj));
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(null);
  };

  if (!isOpen) return null;

  const days = getDaysInMonth();
  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];
  const todayEvents = getEventsForDate(new Date());

  return (
    <div className="calendar-modal-overlay" onClick={onClose}>
      <div className="calendar-modal" onClick={(e) => e.stopPropagation()}>
        <div className="calendar-modal-header">
          <h2 className="calendar-modal-title">
            <HiCalendar className="calendar-modal-title-icon" />
            캘린더
          </h2>
          <button className="calendar-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="calendar-modal-content">
          <div className="calendar-container">
            {/* 캘린더 네비게이션 */}
            <div className="calendar-nav">
              <button
                className="calendar-nav-button"
                onClick={() => navigateMonth('prev')}
              >
                ←
              </button>
              <div className="calendar-month-year">
                {currentDate.getFullYear()}년 {monthNames[currentDate.getMonth()]}
              </div>
              <button
                className="calendar-nav-button"
                onClick={() => navigateMonth('next')}
              >
                →
              </button>
              <button className="calendar-today-button" onClick={goToToday}>
                오늘
              </button>
            </div>

            {/* 캘린더 그리드 */}
            <div className="calendar-grid">
              {/* 요일 헤더 */}
              {dayNames.map((day) => (
                <div key={day} className="calendar-day-header">
                  {day}
                </div>
              ))}

              {/* 날짜 셀 */}
              {days.map((day, index) => {
                const dayEvents = getEventsForDate(day.date);
                const isSelected = selectedDate && 
                  day.date.getDate() === selectedDate.getDate() &&
                  day.date.getMonth() === selectedDate.getMonth() &&
                  day.date.getFullYear() === selectedDate.getFullYear();

                return (
                  <div
                    key={index}
                    className={`calendar-day-cell ${!day.isCurrentMonth ? 'calendar-day-cell-other-month' : ''} ${isToday(day.date) ? 'calendar-day-cell-today' : ''} ${isSelected ? 'calendar-day-cell-selected' : ''}`}
                    onClick={() => handleDateClick(day.date)}
                  >
                    <div className="calendar-day-number">{day.date.getDate()}</div>
                    {dayEvents.length > 0 && (
                      <div className="calendar-day-events">
                        {dayEvents.slice(0, 2).map((event) => {
                          const status = (event.myStatus || 'none').toLowerCase();
                          const getStatusIcon = () => {
                            switch (event.myStatus) {
                              case 'ACCEPTED':
                                return <HiCheckCircle className="calendar-day-event-icon-svg" />;
                              case 'DECLINED':
                                return <HiXCircle className="calendar-day-event-icon-svg" />;
                              case 'TENTATIVE':
                                return <HiQuestionMarkCircle className="calendar-day-event-icon-svg" />;
                              default:
                                return <HiClock className="calendar-day-event-icon-svg" />;
                            }
                          };
                          return (
                            <div
                              key={event.id}
                              className={`calendar-day-event-item calendar-day-event-item--${status}`}
                              title={event.title}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(day.date);
                              }}
                            >
                              <span className="calendar-day-event-icon">{getStatusIcon()}</span>
                              <span className="calendar-day-event-title">{event.title}</span>
                            </div>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <div className="calendar-day-event-more">+{dayEvents.length - 2}개</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 사이드 패널 */}
          <div className="calendar-sidebar">
            {showCreateForm ? (
              <div className="calendar-create-form">
                <h3 className="calendar-sidebar-title">이벤트 만들기</h3>
                <form onSubmit={handleCreateEvent}>
                  <div className="calendar-form-group">
                    <label className="calendar-form-label">제목 *</label>
                    <input
                      type="text"
                      className="calendar-form-input"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="예: 리액트 스터디 모임"
                      required
                    />
                  </div>

                  <div className="calendar-form-group">
                    <label className="calendar-form-label">설명</label>
                    <textarea
                      className="calendar-form-textarea"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="이벤트 설명"
                      rows={3}
                    />
                  </div>

                  <div className="calendar-form-row">
                    <div className="calendar-form-group">
                      <label className="calendar-form-label">시작일시 *</label>
                      <input
                        type={allDay ? 'date' : 'datetime-local'}
                        className="calendar-form-input"
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

                    <div className="calendar-form-group">
                      <label className="calendar-form-label">종료일시 *</label>
                      <input
                        type={allDay ? 'date' : 'datetime-local'}
                        className="calendar-form-input"
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

                  <div className="calendar-form-group">
                    <label className="calendar-form-checkbox-label">
                      <input
                        type="checkbox"
                        checked={allDay}
                        onChange={(e) => setAllDay(e.target.checked)}
                      />
                      <span>종일 이벤트</span>
                    </label>
                  </div>

                  <div className="calendar-form-group">
                    <label className="calendar-form-label">장소</label>
                    <input
                      type="text"
                      className="calendar-form-input"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="예: 온라인, 회의실 A"
                    />
                  </div>

                  <div className="calendar-form-actions">
                    <button
                      type="button"
                      className="calendar-form-button calendar-form-button-cancel"
                      onClick={() => setShowCreateForm(false)}
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      className="calendar-form-button calendar-form-button-submit"
                      disabled={isCreating}
                    >
                      {isCreating ? '생성 중...' : '만들기'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <>
                <div className="calendar-sidebar-header">
                  <h3 className="calendar-sidebar-title">
                    {selectedDate
                      ? `${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일`
                      : '오늘'}
                  </h3>
                  <button
                    className="calendar-add-event-button"
                    onClick={() => setShowCreateForm(true)}
                  >
                    + 이벤트 만들기
                  </button>
                </div>

                <div className="calendar-events-list">
                  {(selectedDate ? selectedDateEvents : todayEvents).length === 0 ? (
                    <div className="calendar-events-empty">
                      {selectedDate ? '선택한 날짜에 이벤트가 없습니다.' : '오늘 예정된 이벤트가 없습니다.'}
                    </div>
                  ) : (
                    (selectedDate ? selectedDateEvents : todayEvents).map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        teamId={teamId}
                        onStatusChange={fetchEvents}
                      />
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

