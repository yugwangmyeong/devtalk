'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSocketStore } from '@/stores/useSocketStore';
import { useTeamViewStore } from '@/stores/useTeamViewStore';
import { usePersonalSpaceStore } from '@/stores/usePersonalSpaceStore';
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
  const loadedDMUserIdRef = useRef<string | null>(null);
  const isLoadingDMRef = useRef(false);
  const isPromotingAnnouncementRef = useRef(false);
  const isPersonalSpaceActiveRef = useRef(false);

  // selectedRoom이 변경될 때 NotificationProvider에 알림
  useEffect(() => {
    const roomId = selectedRoom?.id || null;
    console.log('[TeamsPage] Selected room changed, notifying NotificationProvider:', roomId);
    window.dispatchEvent(new CustomEvent('currentRoomChanged', { detail: { roomId } }));
  }, [selectedRoom]);
  const announcementChannel = useMemo(
    () => channels.find((channel) => channel.type === 'ANNOUNCEMENT'),
    [channels]
  );
  const canManageAnnouncements = selectedTeam?.role === 'OWNER' || selectedTeam?.role === 'ADMIN';
  const isAnnouncementChannel = selectedChannel?.type === 'ANNOUNCEMENT';
  const isWorkspaceChannel = Boolean(
    selectedChannel && selectedRoom && selectedRoom.type === 'GROUP' && !selectedRoom.isPersonalSpace
  );


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
        const dmUserIdFromUrl = searchParams.get('dmUserId');
        if (channelIdFromUrl && !isPersonalSpaceActiveRef.current) {
          const channelToSelect = fetchedChannels.find((c: Channel) => c.id === channelIdFromUrl);
          if (channelToSelect) {
            setSelectedChannel(channelToSelect);
            // 채널을 ChatRoom 형태로 변환
            const room: ChatRoom = {
              id: channelToSelect.chatRoomId, // Use chatRoomId for messages
              name: channelToSelect.name,
              type: 'GROUP', // Use 'GROUP' type for team channels (not 'TEAM_CHANNEL')
              isPersonalSpace: false,
              members: channelToSelect.members || [],
              lastMessage: channelToSelect.lastMessage,
              updatedAt: channelToSelect.updatedAt,
            };
            console.log('[TeamsPage] Channel loaded from URL, room type:', room.type, 'channel:', channelToSelect.name);
            setSelectedRoom(room);
            isPersonalSpaceActiveRef.current = false;
          }
        } else if (!dmUserIdFromUrl && !isPersonalSpaceActiveRef.current) {
          // channelId가 없으면 선택된 채널 초기화
          setSelectedChannel(null);
          setSelectedRoom(null);
          isPersonalSpaceActiveRef.current = false;
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

  // URL의 channelId가 변경될 때 채널 선택 업데이트
  useEffect(() => {
    const channelIdFromUrl = searchParams.get('channelId');
    const teamIdFromUrl = searchParams.get('teamId');
    const dmUserIdFromUrl = searchParams.get('dmUserId');
    const isPersonalSpaceActive = isPersonalSpaceActiveRef.current;
    
    // teamId와 channelId가 모두 있고, 채널 목록이 로드되었을 때만 처리
    if (!isPersonalSpaceActive && teamIdFromUrl && channelIdFromUrl && channels.length > 0 && selectedTeam) {
      const channelToSelect = channels.find((c: Channel) => c.id === channelIdFromUrl);
      
      // 현재 선택된 채널과 다를 때만 업데이트
      if (channelToSelect && selectedChannel?.id !== channelToSelect.id) {
        console.log('[TeamsPage] URL channelId changed, selecting channel:', channelToSelect.name);
        setSelectedChannel(channelToSelect);
        // 채널을 ChatRoom 형태로 변환
        const room: ChatRoom = {
          id: channelToSelect.chatRoomId,
          name: channelToSelect.name,
          type: 'GROUP',
          isPersonalSpace: false,
          members: channelToSelect.members || [],
          lastMessage: channelToSelect.lastMessage,
          updatedAt: channelToSelect.updatedAt,
        };
        setSelectedRoom(room);
        // DM ref 초기화
        loadedDMUserIdRef.current = null;
        isPersonalSpaceActiveRef.current = false;
      } else if (!channelToSelect && channelIdFromUrl) {
        // URL에 channelId가 있지만 채널을 찾을 수 없는 경우 초기화
        console.log('[TeamsPage] Channel not found in list, clearing selection');
        setSelectedChannel(null);
        setSelectedRoom(null);
        loadedDMUserIdRef.current = null;
        isPersonalSpaceActiveRef.current = false;
      }
    } else if (!isPersonalSpaceActive && !channelIdFromUrl && !dmUserIdFromUrl && selectedChannel) {
      // URL에 channelId가 없는데 채널이 선택되어 있으면 초기화
      console.log('[TeamsPage] No channelId in URL, clearing selection');
      setSelectedChannel(null);
      setSelectedRoom(null);
      loadedDMUserIdRef.current = null;
      isPersonalSpaceActiveRef.current = false;
    }
  }, [searchParams, channels, selectedTeam, selectedChannel]);

  const { personalSpaceRoom: storePersonalSpaceRoom, fetchPersonalSpace } = usePersonalSpaceStore();

  // Handle personal space click - use personal space room from store (same as ChatPage)
  const handlePersonalSpaceClick = useCallback(async () => {
    if (!user) {
      return;
    }

    setIsLoadingMessages(true);
    try {
      // ChatPage에서 사용하는 것과 동일한 personal space room 사용
      const personalSpaceRoom = storePersonalSpaceRoom || await fetchPersonalSpace();
      
      if (personalSpaceRoom) {
        console.log('[TeamsPage] Personal space selected (from store):', personalSpaceRoom.id);
        
        // Clear selected channel when personal space is selected
        setSelectedChannel(null);
        setSelectedRoom(personalSpaceRoom);
        loadedDMUserIdRef.current = null; // Personal space는 DM이 아니므로 ref 초기화
        isPersonalSpaceActiveRef.current = true;
        
        // URL 업데이트하지 않음 (요구사항)
      } else {
        alert('나만의 공간을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('[TeamsPage] Failed to get personal space:', error);
      alert('나만의 공간을 불러오는데 실패했습니다.');
    } finally {
      setIsLoadingMessages(false);
    }
  }, [user, storePersonalSpaceRoom, fetchPersonalSpace]);

  // Handle DM click - create or get existing DM room
  const handleDMClick = useCallback(async (userId: string) => {
    if (!selectedTeam || !user) {
      return;
    }

    // 이미 같은 DM을 로드 중이거나 로드된 경우 중복 호출 방지
    if (isLoadingDMRef.current || loadedDMUserIdRef.current === userId) {
      return;
    }

    isLoadingDMRef.current = true;
    setIsLoadingMessages(true);
    try {
      // Create or get existing DM room
      const response = await fetch('/api/chat/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        const data = await response.json();
        const dmRoom: ChatRoom = {
          id: data.room.id,
          name: data.room.name,
          type: 'DM',
          isPersonalSpace: data.room.isPersonalSpace || false,
          members: data.room.members || [],
          lastMessage: data.room.lastMessage,
          updatedAt: data.room.updatedAt,
        };
        
        console.log('[TeamsPage] DM room selected:', dmRoom.id, 'with user:', userId);
        
        // Clear selected channel when DM is selected
        setSelectedChannel(null);
        setSelectedRoom(dmRoom);
        loadedDMUserIdRef.current = userId;
        isPersonalSpaceActiveRef.current = false;
        
        // Update URL to reflect DM selection
        router.replace(`/teams?teamId=${selectedTeam.id}&dmUserId=${userId}`);
      } else {
        const errorData = await response.json();
        console.error('[TeamsPage] Failed to create/get DM room:', errorData);
        alert(errorData.error || 'DM을 시작하는데 실패했습니다.');
      }
    } catch (error) {
      console.error('[TeamsPage] Failed to create/get DM room:', error);
      alert('DM을 시작하는데 실패했습니다.');
    } finally {
      setIsLoadingMessages(false);
      isLoadingDMRef.current = false;
    }
  }, [selectedTeam, user, router]);

  // Handle DM from URL
  useEffect(() => {
    const dmUserIdFromUrl = searchParams.get('dmUserId');
    const channelIdFromUrl = searchParams.get('channelId');
    const isPersonalSpaceActive = isPersonalSpaceActiveRef.current;
    
    // Only load DM if URL has dmUserId and no channel is selected
    if (!isPersonalSpaceActive && dmUserIdFromUrl && selectedTeam && user && !channelIdFromUrl) {
      // 이미 같은 DM이 로드되었거나 로드 중이면 스킵
      if (loadedDMUserIdRef.current === dmUserIdFromUrl || isLoadingDMRef.current) {
        return;
      }
      
      // Check if we already have this DM room loaded in selectedRoom
      const currentDMUserId = selectedRoom?.type === 'DM' 
        ? selectedRoom.members.find(m => m.id !== user.id)?.id 
        : null;
      
      // URL의 dmUserId와 현재 로드된 DM이 다르면 로드
      if (currentDMUserId !== dmUserIdFromUrl) {
        handleDMClick(dmUserIdFromUrl);
      } else {
        // 이미 로드된 경우 ref 업데이트
        loadedDMUserIdRef.current = dmUserIdFromUrl;
      }
    } else if (!dmUserIdFromUrl && !isPersonalSpaceActive) {
      // URL에 dmUserId가 없으면 ref 초기화
      loadedDMUserIdRef.current = null;
    }
  }, [searchParams, selectedTeam, user, handleDMClick]);

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
    if (!selectedRoom || !socket || !isConnected || !isAuthenticated) {
      return;
    }

    // Personal space는 소켓 룸에 조인하지 않지만, messageSent 이벤트는 받아야 함
    if (!selectedRoom.isPersonalSpace) {
      socket.emit('joinRoom', { roomId: selectedRoom.id });
    } else {
      console.log('[TeamsPage] Personal space, skipping room join but listening to messageSent');
    }

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
        setMessages((prev) => {
          // 중복 체크
          const exists = prev.some(m => m.id === message.id);
          if (exists) {
            return prev;
          }
          return [...prev, message];
        });
      }
    };

    const handleMessageUpdated = (data: {
      id: string;
      content: string;
      userId: string;
      chatRoomId: string;
      createdAt: Date | string;
      updatedAt: Date | string;
      user: {
        id: string;
        email: string;
        name: string | null;
        profileImageUrl: string | null;
        teamRole?: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
      };
    }) => {
      if (data.chatRoomId === selectedRoom.id) {
        const updatedMessage: Message = {
          id: data.id,
          content: data.content,
          userId: data.userId,
          chatRoomId: data.chatRoomId,
          createdAt: typeof data.createdAt === 'string' ? data.createdAt : data.createdAt.toISOString(),
          updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : data.updatedAt.toISOString(),
          user: data.user,
        };
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === updatedMessage.id ? updatedMessage : msg
          )
        );
      }
    };

    const handleMessageDeleted = (data: { messageId: string; roomId: string }) => {
      if (data.roomId === selectedRoom.id) {
        setMessages((prev) => prev.filter((msg) => msg.id !== data.messageId));
      }
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('messageSent', handleNewMessage);
    socket.on('messageUpdated', handleMessageUpdated);
    socket.on('messageDeleted', handleMessageDeleted);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('messageSent', handleNewMessage);
      socket.off('messageUpdated', handleMessageUpdated);
      socket.off('messageDeleted', handleMessageDeleted);
      // Personal space가 아닐 때만 leaveRoom
      if (!selectedRoom.isPersonalSpace) {
        socket.emit('leaveRoom', { roomId: selectedRoom.id });
      }
    };
  }, [selectedRoom?.id, selectedRoom?.isPersonalSpace, socket, isConnected, isAuthenticated]);

  // Handle channel click
  const handleChannelClick = (channel: Channel) => {
    isPersonalSpaceActiveRef.current = false;
    setSelectedChannel(channel);
    // Channel 선택 시 DM ref 초기화
    loadedDMUserIdRef.current = null;
    const room: ChatRoom = {
      id: channel.chatRoomId, // Use chatRoomId for messages
      name: channel.name,
      type: 'GROUP', // Use 'GROUP' type for team channels (not 'TEAM_CHANNEL')
      isPersonalSpace: false,
      members: channel.members || [],
      lastMessage: channel.lastMessage,
      updatedAt: channel.updatedAt,
    };
    console.log('[TeamsPage] Channel selected, room type:', room.type, 'channel:', channel.name);
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
    const isPersonalSpaceRoom = selectedRoom.isPersonalSpace;

    // Personal space는 항상 HTTP API 사용
    if (isPersonalSpaceRoom) {
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
            createdAt:
              typeof data.message.createdAt === 'string'
                ? data.message.createdAt
                : new Date(data.message.createdAt).toISOString(),
          };

          setMessages((prev) => {
            const exists = prev.some((m) => m.id === message.id);
            if (exists) {
              return prev;
            }
            return [...prev, message];
          });
          setMessageInput('');
        } else {
          const error = await response.json();
          alert(error.error || '메시지 전송에 실패했습니다.');
        }
      } catch (error) {
        console.error('[TeamsPage] Failed to send personal space message:', error);
        alert('메시지 전송에 실패했습니다.');
      }
      return;
    }

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
          createdAt:
            typeof data.message.createdAt === 'string'
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

  const handlePromoteToAnnouncement = useCallback(
    async (message: Message) => {
      if (!selectedTeam || !announcementChannel || isPromotingAnnouncementRef.current) {
        return;
      }

      isPromotingAnnouncementRef.current = true;
      try {
        const response = await fetch(`/api/teams/${selectedTeam.id}/announcements`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sourceMessageId: message.id }),
        });

        if (response.ok) {
          alert('공지 채널에 추가되었습니다.');
        } else {
          const errorData = await response.json().catch(() => ({}));
          alert(errorData.error || '공지로 보내기에 실패했습니다.');
        }
      } catch (error) {
        console.error('[TeamsPage] Failed to promote announcement:', error);
        alert('공지로 보내기에 실패했습니다.');
      } finally {
        isPromotingAnnouncementRef.current = false;
      }
    },
    [announcementChannel, selectedTeam]
  );

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
                  onDMClick={handleDMClick}
                  onPersonalSpaceClick={handlePersonalSpaceClick}
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
                    isWorkspaceChannel={isWorkspaceChannel}
                    isAnnouncementChannel={isAnnouncementChannel}
                    canPostAnnouncements={canManageAnnouncements}
                    canPromoteToAnnouncement={
                      Boolean(
                        isWorkspaceChannel &&
                          !isAnnouncementChannel &&
                          canManageAnnouncements &&
                          announcementChannel?.chatRoomId
                      )
                    }
                    announcementRoomId={announcementChannel?.chatRoomId}
                    onPromoteToAnnouncement={handlePromoteToAnnouncement}
                    onMessageUpdate={(message) => {
                      setMessages((prev) =>
                        prev.map((msg) => (msg.id === message.id ? message : msg))
                      );
                    }}
                    onMessageDelete={(messageId) => {
                      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
                    }}
                  />
                ) : (
                  <div className="chat-empty-state">
                    <p>채널 또는 DM을 선택해주세요</p>
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
            <TeamPanel isOpen={true} onClose={() => { }} isFullPage={true} />
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

