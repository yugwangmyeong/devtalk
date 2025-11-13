'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSocketStore } from '@/stores/useSocketStore';
import { useTeamViewStore } from '@/stores/useTeamViewStore';
import { Sidebar } from '@/components/layouts/Sidebar';
import { TeamPanel } from './TeamPanel';
import { TeamChannelsPanel } from './TeamChannelsPanel';
import { ChatArea } from '@/components/chat/ChatArea';
import type { ChatRoom, Message } from '@/components/chat/types';
import type { Channel } from './TeamDetailView';
import './TeamsPage.css';
import '@/components/css/ChatPage.css';

export function TeamsPage() {
  const { user, isLoading: isAuthLoading } = useAuthStore();
  const { socket, isConnected, isAuthenticated } = useSocketStore();
  const { selectedTeam, selectTeam, closeChannelsPanel } = useTeamViewStore();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // TeamsPage에 진입할 때 항상 Sidebar의 채널 패널 닫기
  useEffect(() => {
    closeChannelsPanel();
  }, [closeChannelsPanel]);

  // 뒤로가기 버튼 처리 - team-panel-content 클릭으로 인한 의도치 않은 네비게이션 방지
  useEffect(() => {
    const handlePopState = () => {
      // 뒤로가기 버튼을 눌렀을 때 URL이 변경되면 자동으로 상태가 업데이트됨
      // searchParams는 이미 URL 변경을 감지하므로 여기서는 추가 처리만 수행
      const currentTeamId = searchParams.get('teamId');
      if (!currentTeamId && selectedTeam) {
        // URL에 teamId가 없는데 selectedTeam이 있으면 선택 해제
        selectTeam(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [searchParams, selectedTeam, selectTeam]);

  // Load team from URL if teamId is present
  useEffect(() => {
    const teamIdFromUrl = searchParams.get('teamId');
    if (teamIdFromUrl) {
      // URL에 teamId가 있으면 항상 해당 팀을 선택
      // TeamsPage에서는 자체적으로 TeamChannelsPanel을 표시하므로 Sidebar의 채널 패널은 닫아야 함
      closeChannelsPanel();
      
      if (!selectedTeam || selectedTeam.id !== teamIdFromUrl) {
        // Fetch team details and select it
        const fetchTeam = async () => {
          try {
            const response = await fetch('/api/teams');
            if (response.ok) {
              const data = await response.json();
              const team = data.teams?.find((t: any) => t.id === teamIdFromUrl);
              if (team) {
                selectTeam(team);
                // selectTeam 호출 후 바로 채널 패널 닫기 (selectTeam이 자동으로 열기 때문)
                closeChannelsPanel();
              }
            }
          } catch (error) {
            console.error('Failed to fetch team:', error);
          }
        };
        fetchTeam();
      }
    } else {
      // URL에 teamId가 없으면 팀 선택 해제 및 Sidebar의 채널 패널 닫기
      if (selectedTeam) {
        selectTeam(null);
      }
      closeChannelsPanel();
    }
  }, [searchParams, selectedTeam, selectTeam, closeChannelsPanel]);

  // Fetch channels for the selected team
  const fetchChannels = useCallback(async () => {
    if (!selectedTeam) {
      setChannels([]);
      setSelectedChannel(null);
      setSelectedRoom(null);
      return;
    }

    setIsLoadingChannels(true);
    try {
      const response = await fetch(`/api/teams/${selectedTeam.id}/channels`);
      if (response.ok) {
        const data = await response.json();
        const fetchedChannels = data.channels || [];
        setChannels(fetchedChannels);
        
        // URL에서 channelId 읽어서 채널 선택
        const channelIdFromUrl = searchParams.get('channelId');
        if (channelIdFromUrl) {
          const channelToSelect = fetchedChannels.find((c: Channel) => c.id === channelIdFromUrl);
          if (channelToSelect) {
            setSelectedChannel(channelToSelect);
            // 채널을 ChatRoom 형태로 변환
            const room: ChatRoom = {
              id: channelToSelect.chatRoomId, // Use chatRoomId for messages
              name: channelToSelect.name,
              type: 'TEAM_CHANNEL',
              isPersonalSpace: false,
              members: channelToSelect.members || [],
              lastMessage: channelToSelect.lastMessage,
              updatedAt: channelToSelect.updatedAt,
            };
            setSelectedRoom(room);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch channels:', error);
    } finally {
      setIsLoadingChannels(false);
    }
  }, [selectedTeam, searchParams]);

  // Handle channel creation callback
  const handleChannelCreated = useCallback(() => {
    fetchChannels();
  }, [fetchChannels]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Fetch messages when channel is selected
  useEffect(() => {
    if (!selectedRoom) {
      setMessages([]);
      return;
    }

    setIsLoadingMessages(true);
    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/chat/messages?roomId=${selectedRoom.id}`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [selectedRoom]);

  // Join room when selected and socket is connected
  useEffect(() => {
    if (selectedRoom && socket && isConnected && isAuthenticated) {
      socket.emit('joinRoom', { roomId: selectedRoom.id });

      const handleNewMessage = (data: {
        id: string;
        content: string;
        userId: string;
        chatRoomId: string;
        createdAt: Date | string;
        user: {
          id: string;
          email: string;
          name: string | null;
          profileImageUrl: string | null;
        };
      }) => {
        if (data.chatRoomId === selectedRoom.id) {
          const message: Message = {
            ...data,
            createdAt: typeof data.createdAt === 'string' ? data.createdAt : data.createdAt.toISOString(),
          };
          setMessages((prev) => [...prev, message]);
        }
      };

      socket.on('newMessage', handleNewMessage);
      socket.on('messageSent', handleNewMessage);

      return () => {
        socket.off('newMessage', handleNewMessage);
        socket.off('messageSent', handleNewMessage);
        socket.emit('leaveRoom', { roomId: selectedRoom.id });
      };
    }
  }, [selectedRoom?.id, socket, isConnected, isAuthenticated]);

  // Handle channel click
  const handleChannelClick = (channel: Channel) => {
    setSelectedChannel(channel);
    const room: ChatRoom = {
      id: channel.chatRoomId, // Use chatRoomId for messages
      name: channel.name,
      type: 'TEAM_CHANNEL',
      isPersonalSpace: false,
      members: channel.members || [],
      lastMessage: channel.lastMessage,
      updatedAt: channel.updatedAt,
    };
    setSelectedRoom(room);
    router.replace(`/teams?teamId=${selectedTeam?.id}&channelId=${channel.id}`);
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!selectedRoom || !messageInput.trim()) {
      return;
    }

    const content = messageInput.trim();
    const roomId = selectedRoom.id;

    const isSocketReady = socket && isConnected && isAuthenticated;

    if (isSocketReady) {
      socket.emit('sendMessage', {
        roomId,
        content,
      });
      setMessageInput('');
      return;
    }

    // Socket이 없으면 HTTP API 사용
    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomId, content }),
      });

      if (response.ok) {
        const data = await response.json();
        const message: Message = {
          ...data.message,
          createdAt: typeof data.message.createdAt === 'string'
            ? data.message.createdAt
            : new Date(data.message.createdAt).toISOString(),
        };
        setMessages((prev) => [...prev, message]);
        setMessageInput('');
      } else {
        const error = await response.json();
        alert(error.error || '메시지 전송에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('메시지 전송에 실패했습니다.');
    }
  };

  // URL에서 teamId 확인
  const teamIdFromUrl = searchParams.get('teamId');

  return (
    <div className="teams-page-container">
      <Sidebar />
      {teamIdFromUrl ? (
        /* teamId가 있을 때: TeamPanel 숨기고 TeamChannelsPanel + ChatArea 표시 */
        <div className="teams-page-layout">
          {selectedTeam ? (
            <>
              <div className="teams-channels-panel">
                <TeamChannelsPanel
                  isOpen={true}
                  onClose={() => {
                    // URL만 업데이트하면 TeamPanel이 다시 표시됨
                    router.replace('/teams');
                  }}
                  channels={channels}
                  selectedChannel={selectedChannel}
                  isLoadingChannels={isLoadingChannels}
                  onChannelClick={handleChannelClick}
                  onChannelCreated={handleChannelCreated}
                />
              </div>

              {/* Right Panel - Chat Area */}
              <div className="teams-chat-area">
                {selectedRoom ? (
                  <ChatArea
                    room={selectedRoom}
                    messages={messages}
                    messageInput={messageInput}
                    user={user}
                    isLoadingMessages={isLoadingMessages}
                    onMessageInputChange={setMessageInput}
                    onSendMessage={handleSendMessage}
                  />
                ) : (
                  <div className="chat-empty-state">
                    <p>채널을 선택해주세요</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="teams-loading-state">
              <p>워크스페이스를 불러오는 중...</p>
            </div>
          )}
        </div>
      ) : (
        /* teamId가 없을 때: TeamPanel 표시 */
        <>
          <div className="teams-panel-container">
            <TeamPanel isOpen={true} onClose={() => {}} isFullPage={true} />
          </div>
          <div className="teams-page-layout">
            <div className="teams-empty-state">
              <p>워크스페이스를 선택해주세요</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

