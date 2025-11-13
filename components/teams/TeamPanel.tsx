'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTeamViewStore } from '@/stores/useTeamViewStore';
import './TeamPanel.css';

export interface Team {
  id: string;
  name: string;
  description: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    email: string;
    name: string | null;
    profileImageUrl: string | null;
  };
  members: Array<{
    id: string;
    email: string;
    name: string | null;
    profileImageUrl: string | null;
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
    joinedAt: string;
  }>;
  memberCount: number;
  roomCount: number;
}

interface TeamPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isFullPage?: boolean;
}

export function TeamPanel({ isOpen, onClose, isFullPage = false }: TeamPanelProps) {
  const { user } = useAuthStore();
  const { selectTeam } = useTeamViewStore();
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 패널 닫기 (fullpage 모드가 아닐 때만)
  useEffect(() => {
    if (isFullPage) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen && !isFullPage) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, isFullPage]);

  // team-panel-content 빈 공간 클릭 시 아무 동작도 하지 않도록
  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 팀 아이템이나 버튼이 아닌 빈 공간을 클릭한 경우에만 이벤트 전파 중지
    const target = e.target as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;
    
    // 클릭한 요소가 team-panel-content 자체인 경우에만 이벤트 전파 중지
    // 내부의 팀 아이템이나 버튼을 클릭한 경우는 이벤트가 버블링되어 정상적으로 동작함
    if (target === currentTarget) {
      e.stopPropagation();
    }
  };

  // 팀 목록 가져오기
  const fetchTeams = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/teams');
      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '팀 목록을 가져오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
      setError('팀 목록을 가져오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // 패널이 열릴 때마다 팀 목록 가져오기
  useEffect(() => {
    if (isOpen && user) {
      fetchTeams();
    }
  }, [isOpen, user, fetchTeams]);

  // 팀 생성
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!teamName.trim()) {
      setError('팀 이름을 입력해주세요.');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: teamName.trim(),
          description: teamDescription.trim() || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTeams((prev) => [data.team, ...prev]);
        setTeamName('');
        setTeamDescription('');
        setShowCreateForm(false);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '팀 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to create team:', error);
      setError('팀 생성에 실패했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  // 역할 표시
  const getRoleLabel = (role: Team['role']) => {
    switch (role) {
      case 'OWNER':
        return '소유자';
      case 'ADMIN':
        return '관리자';
      case 'MEMBER':
        return '멤버';
      default:
        return role;
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`team-panel ${isFullPage ? 'team-panel-fullpage' : ''}`} ref={panelRef}>
      {!isFullPage && (
        <div className="team-panel-header">
          <h3 className="team-panel-title">워크스페이스</h3>
          <button
            className="team-panel-close"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </div>
      )}

      <div className="team-panel-content" onClick={handleContentClick}>
        {error && (
          <div className="team-panel-error">
            {error}
          </div>
        )}

        {!showCreateForm ? (
          <button
            className="team-create-button"
            onClick={() => setShowCreateForm(true)}
          >
            <svg className="team-create-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            팀 만들기
          </button>
        ) : (
          <form className="team-create-form" onSubmit={handleCreateTeam}>
            <div className="team-create-form-header">
              <h4>새 팀 만들기</h4>
              <button
                type="button"
                className="team-create-form-cancel"
                onClick={() => {
                  setShowCreateForm(false);
                  setTeamName('');
                  setTeamDescription('');
                  setError(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="team-create-form-group">
              <label className="team-create-form-label">팀 이름 *</label>
              <input
                type="text"
                className="team-create-form-input"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="팀 이름을 입력하세요"
                maxLength={100}
                required
                autoFocus
              />
            </div>
            <div className="team-create-form-group">
              <label className="team-create-form-label">설명 (선택사항)</label>
              <textarea
                className="team-create-form-textarea"
                value={teamDescription}
                onChange={(e) => setTeamDescription(e.target.value)}
                placeholder="팀에 대한 설명을 입력하세요"
                rows={3}
              />
            </div>
            <div className="team-create-form-actions">
              <button
                type="button"
                className="team-create-form-button team-create-form-button-cancel"
                onClick={() => {
                  setShowCreateForm(false);
                  setTeamName('');
                  setTeamDescription('');
                  setError(null);
                }}
                disabled={isCreating}
              >
                취소
              </button>
              <button
                type="submit"
                className="team-create-form-button team-create-form-button-submit"
                disabled={isCreating || !teamName.trim()}
              >
                {isCreating ? '생성 중...' : '만들기'}
              </button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="team-empty">
            <p>로딩 중...</p>
          </div>
        ) : teams.length === 0 ? (
          <div className="team-empty">
            <p>참여한 팀이 없습니다</p>
            <p className="team-empty-hint">팀 만들기 버튼을 눌러 새 팀을 만들어보세요</p>
          </div>
        ) : (
          <div className="team-list">
            {teams.map((team) => (
              <div 
                key={team.id} 
                className="team-item"
                onClick={() => {
                  if (!isFullPage) {
                    selectTeam(team);
                    onClose();
                  } else {
                    // 전체 페이지 모드에서는 URL만 업데이트 (TeamsPage에서 URL 변경 감지하여 팀 선택)
                    router.replace(`/teams?teamId=${team.id}`);
                  }
                  // 워크스페이스 선택 시 채널 패널도 자동으로 열림 (store에서 처리)
                }}
              >
                <div className="team-item-header">
                  <div className="team-item-icon">
                    {team.name[0]?.toUpperCase() || 'T'}
                  </div>
                  <div className="team-item-info">
                    <div className="team-item-name">{team.name}</div>
                    <div className="team-item-meta">
                      <span className="team-item-role">{getRoleLabel(team.role)}</span>
                      <span className="team-item-separator">•</span>
                      <span className="team-item-count">{team.memberCount}명</span>
                      {team.roomCount > 0 && (
                        <>
                          <span className="team-item-separator">•</span>
                          <span className="team-item-count">{team.roomCount}개 채팅방</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {team.description && (
                  <p className="team-item-description">{team.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

