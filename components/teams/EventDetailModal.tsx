'use client';

import { useEffect } from 'react';
import type { Event } from './EventCard';
import { EventCard } from './EventCard';
import './EventDetailModal.css';

interface EventDetailModalProps {
  isOpen: boolean;
  event: Event | null;
  teamId: string;
  onClose: () => void;
  onStatusChange?: () => void;
}

export function EventDetailModal({ 
  isOpen, 
  event, 
  teamId, 
  onClose, 
  onStatusChange 
}: EventDetailModalProps) {
  // ESC 키로 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // 모달이 열릴 때 body 스크롤 방지
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !event) return null;

  return (
    <div className="event-detail-modal-overlay" onClick={onClose}>
      <div className="event-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="event-detail-modal-header">
          <h3 className="event-detail-modal-title">이벤트 상세</h3>
          <button className="event-detail-modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="event-detail-modal-content">
          <EventCard
            event={event}
            teamId={teamId}
            onStatusChange={() => {
              if (onStatusChange) {
                onStatusChange();
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}




