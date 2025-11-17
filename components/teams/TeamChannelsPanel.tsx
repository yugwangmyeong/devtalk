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
  onDMClick?: (userId: string) => void;
  onPersonalSpaceClick?: () => void; // 나만의 공간 클릭 핸들러
}

export function TeamChannelsPanel({ 
  isOpen, 
  onClose,
  channels: externalChannels,
  selectedChannel: externalSelectedChannel,
  isLoadingChannels: externalIsLoadingChannels,
  onChannelClick: externalOnChannelClick,
  onChannelCreated,
  onDMClick,
  onPersonalSpaceClick,
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
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; email: string; name: string | null; profileImageUrl: string | null }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; email: string; name: string | null; profileImageUrl: string | null; role: string }>>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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

  // Fetch team members
  const fetchTeamMembers = useCallback(async () => {
    if (!selectedTeam) {
      setTeamMembers([]);
      return;
    }

    setIsLoadingMembers(true);
    try {
      const response = await fetch(`/api/teams/${selectedTeam.id}/members`);
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data.members || []);
      } else {
        console.error('Failed to fetch team members');
      }
    } catch (error) {
      console.error('Failed to fetch team members:', error);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [selectedTeam]);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

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

  // 외부 클릭 시 패널 닫기 (TeamsPage에서 사용할 때는 비활성화)
  useEffect(() => {
    // externalOnChannelClick이 있으면 TeamsPage에서 사용 중이므로 외부 클릭 핸들러 비활성화
    if (externalOnChannelClick) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, externalOnChannelClick]);

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

  // Search users
  const handleSearchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`, {
        credentials: 'include', // Include cookies for authentication
      });
      if (response.ok) {
        const data = await response.json();
        // Filter out users who are already team members
        const existingMemberIds = new Set(teamMembers.map(m => m.id));
        const filteredUsers = (data.users || []).filter((u: { id: string }) => !existingMemberIds.has(u.id));
        setSearchResults(filteredUsers);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Failed to search users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search input change
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    handleSearchUsers(value);
  };

  // Invite user to team
  const handleInviteUser = async (userId: string) => {
    if (!selectedTeam) {
      console.error('[TeamChannelsPanel] Cannot invite: selectedTeam is null');
      setError('팀이 선택되지 않았습니다.');
      return;
    }

    console.log('[TeamChannelsPanel] Inviting user:', { userId, teamId: selectedTeam.id });
    setIsInviting(true);
    setInvitingUserId(userId);
    setError(null);

    try {
      const url = `/api/teams/${selectedTeam.id}/members`;
      console.log('[TeamChannelsPanel] Sending invite request to:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({ userId }),
      });

      console.log('[TeamChannelsPanel] Response status:', response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log('[TeamChannelsPanel] Invite successful:', data);
        
        // Refresh team data if needed
        setSearchQuery('');
        setSearchResults([]);
        setShowInviteModal(false);
        setError(null);
        
        // Refresh team members list
        fetchTeamMembers();
        
        // Refresh channels if needed
        if (externalChannels === undefined) {
          fetchChannels();
        } else if (onChannelCreated) {
          onChannelCreated();
        }
      } else {
        let errorMessage = '초대에 실패했습니다.';
        try {
          const errorData = await response.json();
          console.error('[TeamChannelsPanel] Invite failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
          });
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          console.error('[TeamChannelsPanel] Failed to parse error response:', parseError);
          errorMessage = `초대에 실패했습니다. (상태 코드: ${response.status})`;
        }
        setError(errorMessage);
      }
    } catch (error) {
      console.error('[TeamChannelsPanel] Failed to invite user:', error);
      const errorMessage = error instanceof Error ? error.message : '초대에 실패했습니다.';
        setError(`네트워크 오류: ${errorMessage}`);
    } finally {
      setIsInviting(false);
      setInvitingUserId(null);
    }
  };

  if (!isOpen || !selectedTeam) {
    return null;
  }

  return (
    <div className="team-channels-panel" ref={panelRef}>
      {/* Team Header */}
      <div className="team-channels-header">
        <div 
          className="team-channels-team-name"
          onClick={() => {
            // Only OWNER and ADMIN can invite
            const userRole = selectedTeam?.role;
            if (userRole === 'OWNER' || userRole === 'ADMIN') {
              setShowInviteModal(true);
            }
          }}
          style={{ cursor: (selectedTeam?.role === 'OWNER' || selectedTeam?.role === 'ADMIN') ? 'pointer' : 'default' }}
        >
          <span className="team-channels-team-icon">
            {selectedTeam.name[0]?.toUpperCase() || 'T'}
          </span>
          <span className="team-channels-team-text">{selectedTeam.name}</span>
        </div>
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
            {isLoadingMembers ? (
              <div className="team-channels-loading">로딩 중...</div>
            ) : (
              <>
                {/* 본인 항목 - 나만의 공간으로 이동 */}
                {user && (
                  <div 
                    key={`self-${user.id}`}
                    className="team-channels-dm-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      // 나만의 공간 클릭 핸들러 호출 (URL 이동 없이)
                      if (onPersonalSpaceClick) {
                        onPersonalSpaceClick();
                      }
                    }}
                    style={{ cursor: onPersonalSpaceClick ? 'pointer' : 'default' }}
                  >
                    <div className="team-channels-dm-avatar">
                      {user.profileImageUrl ? (
                        <img src={user.profileImageUrl} alt={user.name || user.email || '사용자'} />
                      ) : (
                        <div className="team-channels-dm-avatar-placeholder"></div>
                      )}
                    </div>
                    <span className="team-channels-dm-name">
                      {user.name || user.email}(나)
                    </span>
                  </div>
                )}
                {/* 다른 멤버들 */}
                {teamMembers
                  .filter((member) => member.id !== user?.id) // 현재 사용자 제외
                  .map((member) => (
                    <div 
                      key={member.id} 
                      className="team-channels-dm-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDMClick) {
                          onDMClick(member.id);
                        }
                      }}
                      style={{ cursor: onDMClick ? 'pointer' : 'default' }}
                    >
                      <div className="team-channels-dm-avatar">
                        {member.profileImageUrl ? (
                          <img src={member.profileImageUrl} alt={member.name || member.email || '사용자'} />
                        ) : (
                          <div className="team-channels-dm-avatar-placeholder"></div>
                        )}
                      </div>
                      <span className="team-channels-dm-name">
                        {member.name || member.email}
                        {member.role === 'OWNER' && ' 👑'}
                        {member.role === 'ADMIN' && ' ⭐'}
                      </span>
                    </div>
                  ))
                }
              </>
            )}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="team-invite-modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="team-invite-modal" onClick={(e) => e.stopPropagation()}>
            <div className="team-invite-modal-header">
              <h3 className="team-invite-modal-title">멤버 초대</h3>
              <button
                className="team-invite-modal-close"
                onClick={() => {
                  setShowInviteModal(false);
                  setSearchQuery('');
                  setSearchResults([]);
                  setError(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="team-invite-modal-content">
              <div className="team-invite-search">
                <input
                  type="text"
                  className="team-invite-search-input"
                  placeholder="이메일 또는 이름으로 검색..."
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                  autoFocus
                />
              </div>
              {error && (
                <div className="team-invite-error">
                  {error}
                </div>
              )}
              <div className="team-invite-results">
                {isSearching ? (
                  <div className="team-invite-loading">검색 중...</div>
                ) : searchResults.length === 0 && searchQuery.trim() ? (
                  <div className="team-invite-empty">검색 결과가 없습니다.</div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="team-invite-user-item"
                      onClick={() => handleInviteUser(user.id)}
                    >
                      <div className="team-invite-user-avatar">
                        {user.profileImageUrl ? (
                          <img src={user.profileImageUrl} alt={user.name || user.email} />
                        ) : (
                          <div className="team-invite-user-avatar-placeholder">
                            {user.name?.[0]?.toUpperCase() || user.email[0]?.toUpperCase() || 'U'}
                          </div>
                        )}
                      </div>
                      <div className="team-invite-user-info">
                        <div className="team-invite-user-name">{user.name || user.email}</div>
                        {user.name && <div className="team-invite-user-email">{user.email}</div>}
                      </div>
                      {isInviting && invitingUserId === user.id && (
                        <div className="team-invite-loading-small">초대 중...</div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="team-invite-empty">이메일 또는 이름을 입력하여 검색하세요.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

