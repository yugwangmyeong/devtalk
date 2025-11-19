'use client';

import { useState, useEffect } from 'react';
import { HiX, HiCamera, HiCheck } from 'react-icons/hi';
import './TeamSettingsModal.css';

interface TeamSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: {
    id: string;
    name: string;
    description?: string | null;
    iconUrl?: string | null;
    role: string;
  };
  onTeamUpdated?: () => void;
}

export function TeamSettingsModal({ isOpen, onClose, team, onTeamUpdated }: TeamSettingsModalProps) {
  const [teamName, setTeamName] = useState(team.name);
  const [teamDescription, setTeamDescription] = useState(team.description || '');
  const [iconUrl, setIconUrl] = useState(team.iconUrl || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTeamName(team.name);
      setTeamDescription(team.description || '');
      setIconUrl(team.iconUrl || '');
      setError(null);
    }
  }, [isOpen, team]);

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!teamName.trim()) {
      setError('팀 이름을 입력해주세요.');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/teams/${team.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: teamName.trim(),
          description: teamDescription.trim() || null,
          iconUrl: iconUrl.trim() || null,
        }),
      });

      if (response.ok) {
        if (onTeamUpdated) {
          onTeamUpdated();
        }
        onClose();
      } else {
        const errorData = await response.json();
        setError(errorData.error || '팀 정보 업데이트에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to update team:', error);
      setError('팀 정보 업데이트에 실패했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지 파일 검증
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('파일 크기는 5MB 이하여야 합니다.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setIconUrl(data.url);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '이미지 업로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
      setError('이미지 업로드에 실패했습니다.');
    }
  };

  const iconOptions = [
    '🎯', '🚀', '💼', '🎨', '⚡', '🔥', '🌟', '💡',
    '🎪', '🏆', '🎭', '🎬', '🎵', '🎮', '🏀', '⚽',
    '🌍', '🌙', '⭐', '🌈', '🎁', '🎉', '🎊', '🎈'
  ];

  if (!isOpen) return null;

  return (
    <div className="team-settings-modal-overlay" onClick={onClose}>
      <div className="team-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="team-settings-modal-header">
          <h2 className="team-settings-modal-title">팀 설정</h2>
          <button className="team-settings-modal-close" onClick={onClose}>
            <HiX />
          </button>
        </div>

        <form className="team-settings-modal-content" onSubmit={handleUpdateTeam}>
          {/* Icon Section */}
          <div className="team-settings-icon-section">
            <label className="team-settings-label">팀 아이콘</label>
            <div className="team-settings-icon-preview">
              {iconUrl ? (
                iconUrl.startsWith('emoji:') ? (
                  <div className="team-settings-icon-emoji">
                    {iconUrl.replace('emoji:', '')}
                  </div>
                ) : (
                  <img src={iconUrl} alt="Team icon" className="team-settings-icon-image" />
                )
              ) : (
                <div className="team-settings-icon-placeholder">
                  {teamName[0]?.toUpperCase() || 'T'}
                </div>
              )}
              <label className="team-settings-icon-upload-button">
                <HiCamera />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleIconUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
            <button
              type="button"
              className="team-settings-icon-picker-toggle"
              onClick={() => setShowIconPicker(!showIconPicker)}
            >
              {showIconPicker ? '이모지 선택 닫기' : '이모지로 선택'}
            </button>
            {showIconPicker && (
              <div className="team-settings-icon-picker">
                {iconOptions.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="team-settings-icon-option"
                    onClick={() => {
                      setIconUrl(`emoji:${emoji}`);
                      setShowIconPicker(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Name Section */}
          <div className="team-settings-form-group">
            <label className="team-settings-label">팀 이름 *</label>
            <input
              type="text"
              className="team-settings-input"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="팀 이름을 입력하세요"
              maxLength={100}
              required
            />
          </div>

          {/* Description Section */}
          <div className="team-settings-form-group">
            <label className="team-settings-label">설명</label>
            <textarea
              className="team-settings-textarea"
              value={teamDescription}
              onChange={(e) => setTeamDescription(e.target.value)}
              placeholder="팀에 대한 설명을 입력하세요"
              rows={4}
              maxLength={500}
            />
          </div>

          {error && (
            <div className="team-settings-error">
              {error}
            </div>
          )}

          <div className="team-settings-modal-actions">
            <button
              type="button"
              className="team-settings-button team-settings-button-cancel"
              onClick={onClose}
              disabled={isUpdating}
            >
              취소
            </button>
            <button
              type="submit"
              className="team-settings-button team-settings-button-submit"
              disabled={isUpdating || !teamName.trim()}
            >
              {isUpdating ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

