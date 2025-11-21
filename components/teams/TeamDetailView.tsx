'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTeamViewStore } from '@/stores/useTeamViewStore';
import { useRouter } from 'next/navigation';
import type { Team } from './TeamPanel';
import { EventList } from './EventList';
import './TeamDetailView.css';

export interface Channel {
  id: string; // TeamChannel.id
  name: string;
  description?: string | null;
  type: 'GENERAL' | 'ANNOUNCEMENT';
  teamId: string;
  chatRoomId: string; // ChatRoom.id for messages
  memberCount: number;
  messageCount: number;
  members: Array<{
    id: string;
    email: string;
    name: string | null;
    profileImageUrl: string | null;
  }>;
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
    user: {
      id: string;
      email: string;
      name: string | null;
    };
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface TeamDetailViewProps {
  team: Team;
}

export function TeamDetailView({ team }: TeamDetailViewProps) {
  const { selectTeam } = useTeamViewStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'channels' | 'events'>('channels');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [showCreateChannelForm, setShowCreateChannelForm] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch channels for the team
  const fetchChannels = useCallback(async () => {
    setIsLoadingChannels(true);
    setError(null);
    try {
      const response = await fetch(`/api/teams/${team.id}/channels`);
      if (response.ok) {
        const data = await response.json();
        setChannels(data.channels || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '채널 목록을 가져오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to fetch channels:', error);
      setError('채널 목록을 가져오는데 실패했습니다.');
    } finally {
      setIsLoadingChannels(false);
    }
  }, [team.id]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Create channel
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!channelName.trim()) {
      setError('채널 이름을 입력해주세요.');
      return;
    }

    setIsCreatingChannel(true);
    setError(null);

    try {
      const response = await fetch(`/api/teams/${team.id}/channels`, {
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
        setChannels((prev) => [...prev, data.channel]);
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

  // Handle channel click
  const handleChannelClick = (channel: Channel) => {
    // Navigate to chat page with channel selected
    // Use chatRoomId for navigation (messages are stored in ChatRoom)
    router.push(`/chat?roomId=${channel.chatRoomId}&teamId=${team.id}&channelId=${channel.id}`);
  };

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

  return (
    <div className="team-detail-view">
      <div className="team-detail-header">
        <button
          className="team-detail-back"
          onClick={() => selectTeam(null)}
        >
          ← 뒤로
        </button>
        <div className="team-detail-title-section">
          <div className="team-detail-icon-large">
            {team.name[0]?.toUpperCase() || 'T'}
          </div>
          <div>
            <h2 className="team-detail-name">{team.name}</h2>
            <div className="team-detail-meta">
              <span className="team-detail-role">{getRoleLabel(team.role)}</span>
              <span className="team-detail-separator">•</span>
              <span>{team.memberCount}명</span>
              {team.roomCount > 0 && (
                <>
                  <span className="team-detail-separator">•</span>
                  <span>{team.roomCount}개 채팅방</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {team.description && (
        <div className="team-detail-description-section">
          <p className="team-detail-description">{team.description}</p>
        </div>
      )}

      <div className="team-detail-content">
        <div className="team-detail-section">
          <h3 className="team-detail-section-title">멤버</h3>
          <div className="team-detail-members">
            {team.members.map((member) => (
              <div key={member.id} className="team-detail-member-item">
                <div className="team-detail-member-avatar">
                  {member.profileImageUrl ? (
                    <img src={member.profileImageUrl} alt={member.name || member.email} />
                  ) : (
                    <div className="team-detail-member-avatar-placeholder">
                      {member.name?.[0]?.toUpperCase() || member.email[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                </div>
                <div className="team-detail-member-info">
                  <div className="team-detail-member-name">
                    {member.name || member.email}
                  </div>
                  <div className="team-detail-member-role">
                    {getRoleLabel(member.role)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="team-detail-tabs">
          <button
            className={`team-detail-tab ${activeTab === 'channels' ? 'team-detail-tab-active' : ''}`}
            onClick={() => setActiveTab('channels')}
          >
            💬 채널
          </button>
          <button
            className={`team-detail-tab ${activeTab === 'events' ? 'team-detail-tab-active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            📅 이벤트
          </button>
        </div>

        {activeTab === 'channels' && (
          <div className="team-detail-section">
            <div className="team-detail-section-header">
              <h3 className="team-detail-section-title">채널</h3>
              {!showCreateChannelForm && (
                <button
                  className="team-detail-add-channel"
                  onClick={() => setShowCreateChannelForm(true)}
                  title="채널 만들기"
                >
                  +
                </button>
              )}
            </div>
            
            {showCreateChannelForm && (
              <form className="team-detail-create-channel-form" onSubmit={handleCreateChannel}>
                <input
                  type="text"
                  className="team-detail-channel-input"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="채널 이름 (예: 단체채팅1)"
                  maxLength={100}
                  required
                  autoFocus
                />
                <div className="team-detail-channel-form-actions">
                  <button
                    type="button"
                    className="team-detail-channel-form-button team-detail-channel-form-button-cancel"
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
                    className="team-detail-channel-form-button team-detail-channel-form-button-submit"
                    disabled={isCreatingChannel || !channelName.trim()}
                  >
                    {isCreatingChannel ? '생성 중...' : '만들기'}
                  </button>
                </div>
              </form>
            )}

            {error && (
              <div className="team-detail-error">
                {error}
              </div>
            )}

            <div className="team-detail-channels">
              {isLoadingChannels ? (
                <p className="team-detail-empty">로딩 중...</p>
              ) : channels.length === 0 ? (
                <p className="team-detail-empty">채널이 없습니다. + 버튼을 눌러 채널을 만들어보세요</p>
              ) : (
                channels.map((channel) => (
                  <div
                    key={channel.id}
                    className="team-detail-channel-item"
                    onClick={() => handleChannelClick(channel)}
                  >
                    <span className="team-detail-channel-prefix">#</span>
                    <span className="team-detail-channel-name">{channel.name}</span>
                    {channel.lastMessage && (
                      <span className="team-detail-channel-preview">
                        {channel.lastMessage.content}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="team-detail-events-section">
            <EventList teamId={team.id} />
          </div>
        )}
      </div>
    </div>
  );
}

