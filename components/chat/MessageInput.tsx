'use client';

import type { Message } from './types';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  editingMessage?: Message | null;
  onCancelEdit?: () => void;
}

export function MessageInput({ value, onChange, onSend, disabled, editingMessage, onCancelEdit }: MessageInputProps) {
  const isEditing = !!editingMessage;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSend();
      }
    } else if (e.key === 'Escape' && isEditing && onCancelEdit) {
      e.preventDefault();
      onCancelEdit();
    }
  };

  return (
    <div className="chat-input-section">
      {isEditing && (
        <div className="chat-input-edit-banner">
          <span className="chat-input-edit-label">메시지 수정 중</span>
          {onCancelEdit && (
            <button
              type="button"
              className="chat-input-edit-cancel"
              onClick={onCancelEdit}
              aria-label="수정 취소"
            >
              ✕
            </button>
          )}
        </div>
      )}
      <div className="chat-input-container">
        {!isEditing && (
          <button className="chat-input-attach-button">
            <svg className="chat-input-attach-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
        <input
          type="text"
          className="chat-input-field"
          placeholder={isEditing ? "메시지를 수정하세요..." : ""}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <button
          className="chat-input-send-button"
          onClick={(e) => {
            e.preventDefault();
            if (!disabled && value.trim()) {
              onSend();
            }
          }}
          disabled={!value.trim() || disabled}
        >
          <svg className="chat-input-send-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}

