'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTeamViewStore } from '@/stores/useTeamViewStore';
import { useAuthStore } from '@/stores/useAuthStore';
import type { Channel } from './TeamDetailView';
import './TeamChannelsPanel.css';

interface TeamChannelsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  channels?: Channel[];
  selectedChannel?: Channel | null;
  isLoadingChannels?: boolean;
  onChannelClick?: (channel: Channel) => void;
  onChannelCreated?: () => void;
}

export function TeamChannelsPanel({ 
  isOpen, 
  onClose,
  channels: externalChannels,
  selectedChannel: externalSelectedChannel,
  isLoadingChannels: externalIsLoadingChannels,
  onChannelClick: externalOnChannelClick,
  onChannelCreated,
}: TeamChannelsPanelProps) {
  const { selectedTeam } = useTeamViewStore();
  const { user } = useAuthStore();
  const router = useRouter();
  const [internalChannels, setInternalChannels] = useState<Channel[]>([]);
  const [internalIsLoadingChannels, setInternalIsLoadingChannels] = useState(false);
  const [isChannelsExpanded, setIsChannelsExpanded] = useState(true);
  const [isDMExpanded, setIsDMExpanded] = useState(true);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [showCreateChannelForm, setShowCreateChannelForm] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showTeamMenu, setShowTeamMenu] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Use external props if provided, otherwise use internal state
  const channels = externalChannels ?? internalChannels;
  const isLoadingChannels = externalIsLoadingChannels ?? internalIsLoadingChannels;
  const selectedChannel = externalSelectedChannel ?? null;

  // Fetch channels for the selected team (only if not provided externally)
  const fetchChannels = useCallback(async () => {
    if (!selectedTeam || externalChannels !== undefined) {
      return;
    }

    setInternalIsLoadingChannels(true);
    setError(null);
    try {
      const response = await fetch(`/api/teams/${selectedTeam.id}/channels`);
      if (response.ok) {
        const data = await response.json();
        setInternalChannels(data.channels || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '채널 목록을 가져오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to fetch channels:', error);
      setError('채널 목록을 가져오는데 실패했습니다.');
    } finally {
      setInternalIsLoadingChannels(false);
    }
  }, [selectedTeam, externalChannels]);

  useEffect(() => {
    if (externalChannels === undefined) {
      fetchChannels();
    }
  }, [fetchChannels, externalChannels]);

  // Create channel
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTeam || !channelName.trim()) {
      setError('채널 이름을 입력해주세요.');
      return;
    }

    setIsCreatingChannel(true);
    setError(null);

    try {
      const response = await fetch(`/api/teams/${selectedTeam.id}/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: channelName.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (externalChannels === undefined) {
          setInternalChannels((prev) => [...prev, data.channel]);
        } else {
          // 외부에서 채널 목록을 관리하는 경우 콜백 호출
          if (onChannelCreated) {
            onChannelCreated();
          }
        }
        setChannelName('');
        setShowCreateChannelForm(false);
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '채널 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to create channel:', error);
      setError('채널 생성에 실패했습니다.');
    } finally {
      setIsCreatingChannel(false);
    }
  };

  // Check if user is admin or owner
  const isAdminOrOwner = selectedTeam?.role === 'OWNER' || selectedTeam?.role === 'ADMIN';

  // Handle rename team
  const handleRenameTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !newTeamName.trim()) {
      setError('워크스페이스 이름을 입력해주세요.');
      return;
    }

    setIsRenaming(true);
    setError(null);

    try {
      const response = await fetch(`/api/teams/${selectedTeam.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTeamName.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update selectedTeam in store
        useTeamViewStore.getState().selectTeam(data.team);
        setShowRenameModal(false);
        setNewTeamName('');
        setShowTeamMenu(false);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '워크스페이스 이름 변경에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to rename team:', error);
      setError('워크스페이스 이름 변경에 실패했습니다.');
    } finally {
      setIsRenaming(false);
    }
  };

  // Handle delete team
  const handleDeleteTeam = async () => {
    if (!selectedTeam) return;

    const confirmed = window.confirm(
      `정말로 "${selectedTeam.name}" 워크스페이스를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/teams/${selectedTeam.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Close panel and clear selected team
        useTeamViewStore.getState().selectTeam(null);
        onClose();
        // Refresh teams list if on TeamsPage
        if (window.location.pathname === '/teams') {
          window.location.reload();
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || '워크스페이스 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete team:', error);
      setError('워크스페이스 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
      setShowTeamMenu(false);
    }
  };

  // 외부 클릭 시 패널 닫기 (teams-chat-area는 제외)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!panelRef.current) return;
      
      const target = event.target as Node;
      
      // 메뉴 외부 클릭 시 메뉴 닫기
      if (menuRef.current && !menuRef.current.contains(target)) {
        setShowTeamMenu(false);
      }
      
      // 패널 내부 클릭이면 무시
      if (panelRef.current.contains(target)) {
        return;
      }
      
      // teams-chat-area 내부 클릭이면 무시 (TeamsPage에서 사용할 때)
      const chatArea = document.querySelector('.teams-chat-area');
      if (chatArea && chatArea.contains(target)) {
        return;
      }
      
      // teams-page-layout 내부 클릭이면 무시 (TeamsPage에서 사용할 때)
      const pageLayout = document.querySelector('.teams-page-layout');
      if (pageLayout && pageLayout.contains(target) && !panelRef.current.contains(target)) {
        // teams-page-layout 내부지만 패널 외부인 경우는 무시 (채팅 영역 클릭)
        return;
      }
      
      // 그 외의 경우에만 닫기
      onClose();
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // team-channels-section 빈 공간 클릭 시 아무 동작도 하지 않도록
  const handleSectionClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 리스트의 빈 공간을 클릭한 경우에만 이벤트 전파 중지
    // 채널 아이템이나 다른 인터랙티브 요소를 클릭한 경우는 정상적으로 동작하도록 함
    const target = e.target as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;
    
    // 클릭한 요소가 리스트 컨테이너 자체인 경우에만 이벤트 전파 중지
    // 리스트 내부의 아이템을 클릭한 경우는 이벤트가 버블링되어 정상적으로 동작함
    if (target === currentTarget) {
      e.stopPropagation();
    }
  };

  // Handle channel click
  const handleChannelClick = (channel: Channel) => {
    if (externalOnChannelClick) {
      externalOnChannelClick(channel);
    } else {
      // Use chatRoomId for navigation (messages are stored in ChatRoom)
      router.push(`/chat?roomId=${channel.chatRoomId}&teamId=${selectedTeam?.id}&channelId=${channel.id}`);
    }
  };

  if (!isOpen || !selectedTeam) {
    return null;
  }

  return (
    <div className="team-channels-panel" ref={panelRef}>
      {/* Team Header */}
      <div className="team-channels-header">
        <div className="team-channels-team-name">
          <span 
            className="team-channels-team-icon"
            onClick={(e) => {
              e.stopPropagation();
              if (isAdminOrOwner) {
                setShowTeamMenu(!showTeamMenu);
              }
            }}
            style={{ cursor: isAdminOrOwner ? 'pointer' : 'default' }}
          >
            {selectedTeam.name[0]?.toUpperCase() || 'T'}
          </span>
          <span className="team-channels-team-text">{selectedTeam.name}</span>
        </div>
        
        {/* Team Menu Dropdown */}
        {showTeamMenu && isAdminOrOwner && (
          <div className="team-channels-menu" ref={menuRef}>
            <button
              className="team-channels-menu-item"
              onClick={() => {
                setNewTeamName(selectedTeam.name);
                setShowRenameModal(true);
                setShowTeamMenu(false);
              }}
            >
              이름 변경
            </button>
            <button
              className="team-channels-menu-item team-channels-menu-item-danger"
              onClick={handleDeleteTeam}
              disabled={isDeleting}
            >
              {isDeleting ? '삭제 중...' : '워크스페이스 삭제'}
            </button>
          </div>
        )}
        {/* <button
          className="team-channels-close"
          onClick={() => {
            // externalOnChannelClick이 있으면 TeamsPage에서 사용 중이므로 onClose만 호출
            // 없으면 Sidebar에서 사용 중이므로 selectTeam(null)도 호출
            if (!externalOnChannelClick) {
              selectTeam(null);
            }
            onClose();
          }}
          title="워크스페이스 닫기"
        >
          ×
        </button> */}
      </div>

      {/* Channels Section */}
      <div className="team-channels-section">
        <div 
          className="team-channels-section-header"
          onClick={() => setIsChannelsExpanded(!isChannelsExpanded)}
        >
          <span className="team-channels-section-title">채널</span>
          <div className="team-channels-section-actions">
            {isChannelsExpanded && (
              <button
                className="team-channels-add-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCreateChannelForm(true);
                }}
                title="채널 만들기"
              >
                +
              </button>
            )}
            <svg 
              className={`team-channels-expand-icon ${isChannelsExpanded ? 'expanded' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {isChannelsExpanded && (
          <>
            {showCreateChannelForm && (
              <form className="team-channels-create-form" onSubmit={handleCreateChannel}>
                <input
                  type="text"
                  className="team-channels-create-input"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="채널 이름"
                  maxLength={100}
                  required
                  autoFocus
                />
                <div className="team-channels-create-actions">
                  <button
                    type="button"
                    className="team-channels-create-button team-channels-create-button-cancel"
                    onClick={() => {
                      setShowCreateChannelForm(false);
                      setChannelName('');
                      setError(null);
                    }}
                    disabled={isCreatingChannel}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="team-channels-create-button team-channels-create-button-submit"
                    disabled={isCreatingChannel || !channelName.trim()}
                  >
                    만들기
                  </button>
                </div>
              </form>
            )}

            {error && (
              <div className="team-channels-error">
                {error}
              </div>
            )}

            {/* Rename Team Modal */}
            {showRenameModal && (
              <div className="team-channels-modal-overlay" onClick={() => setShowRenameModal(false)}>
                <div className="team-channels-modal" onClick={(e) => e.stopPropagation()}>
                  <h3 className="team-channels-modal-title">워크스페이스 이름 변경</h3>
                  <form onSubmit={handleRenameTeam}>
                    <input
                      type="text"
                      className="team-channels-create-input"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder="워크스페이스 이름"
                      maxLength={100}
                      required
                      autoFocus
                    />
                    <div className="team-channels-create-actions">
                      <button
                        type="button"
                        className="team-channels-create-button team-channels-create-button-cancel"
                        onClick={() => {
                          setShowRenameModal(false);
                          setNewTeamName('');
                          setError(null);
                        }}
                        disabled={isRenaming}
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        className="team-channels-create-button team-channels-create-button-submit"
                        disabled={isRenaming || !newTeamName.trim()}
                      >
                        {isRenaming ? '변경 중...' : '변경'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="team-channels-list" onClick={handleSectionClick}>
              {isLoadingChannels ? (
                <div className="team-channels-loading">로딩 중...</div>
              ) : channels.length === 0 ? (
                <div className="team-channels-empty">채널이 없습니다</div>
              ) : (
                channels.map((channel) => (
                  <div
                    key={channel.id}
                    className={`team-channels-item ${selectedChannel?.id === channel.id ? 'team-channels-item-selected' : ''}`}
                    onClick={() => handleChannelClick(channel)}
                  >
                    <span className="team-channels-item-prefix">#</span>
                    <span className="team-channels-item-name">{channel.name}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* DM Section */}
      <div className="team-channels-section">
        <div 
          className="team-channels-section-header"
          onClick={() => setIsDMExpanded(!isDMExpanded)}
        >
          <span className="team-channels-section-title">DM</span>
          <svg 
            className={`team-channels-expand-icon ${isDMExpanded ? 'expanded' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {isDMExpanded && (
          <div className="team-channels-dm-list" onClick={handleSectionClick}>
            <div className="team-channels-dm-item">
              <input type="checkbox" className="team-channels-dm-checkbox" />
              <span className="team-channels-dm-name">
                {user?.name || user?.email || '나'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

