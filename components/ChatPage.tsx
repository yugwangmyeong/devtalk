'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSocketStore } from '@/stores/useSocketStore';
import { useTeamViewStore } from '@/stores/useTeamViewStore';
import { usePersonalSpaceStore } from '@/stores/usePersonalSpaceStore';
import { Sidebar } from '@/components/layouts/Sidebar';
import { DMPanel } from './chat/DMPanel';
import { ChatArea } from './chat/ChatArea';
import type { ChatRoom, Message } from './chat/types';
import './css/ChatPage.css';

export function ChatPage() {
  const { user, isLoading: isAuthLoading } = useAuthStore();
  const { socket, isConnected, isAuthenticated } = useSocketStore();
  const { selectTeam, closeChannelsPanel } = useTeamViewStore();
  const { setPersonalSpaceRoom } = usePersonalSpaceStore();
  const searchParams = useSearchParams();
  const router = useRouter();

  // 채팅 페이지 진입 시 워크스페이스 선택 초기화
  useEffect(() => {
    selectTeam(null);
    closeChannelsPanel();
  }, [selectTeam, closeChannelsPanel]);

  // Socket 연결 상태 모니터링
  useEffect(() => {
    console.log('[ChatPage] Socket state:', {
      hasSocket: !!socket,
      socketId: socket?.id,
      isConnected,
      isAuthenticated,
    });
  }, [socket, isConnected, isAuthenticated]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasFetchedRooms, setHasFetchedRooms] = useState(false);

  // selectedRoom이 변경될 때 NotificationProvider에 알림
  useEffect(() => {
    const roomId = selectedRoom?.id || null;
    console.log('[ChatPage] Selected room changed, notifying NotificationProvider:', roomId);
    window.dispatchEvent(new CustomEvent('currentRoomChanged', { detail: { roomId } }));
  }, [selectedRoom]);

  // Fetch chat rooms and ensure personal space exists
  useEffect(() => {
    console.log('[ChatPage] useEffect dependency changed:', {
      user: user ? user.email : null,
      isAuthLoading,
      hasUser: !!user,
      hasFetchedRooms,
    });

    // 인증 로딩 중이거나 user가 없으면 기다림
    if (isAuthLoading) {
      console.log('[ChatPage] Auth still loading, waiting...');
      return;
    }

    if (!user) {
      console.log('[ChatPage] No user, skipping fetch');
      setIsLoadingRooms(false);
      setHasFetchedRooms(false);
      return;
    }

    // 이미 방을 가져왔고, user가 변경되지 않았다면 다시 가져오지 않음
    // (searchParams나 router 변경은 무시)
    if (hasFetchedRooms) {
      console.log('[ChatPage] Rooms already fetched, skipping');
      return;
    }

    const fetchRooms = async () => {
      setHasFetchedRooms(true);
      console.log('[ChatPage] fetchRooms called, user:', user.email);

      try {
        console.log('[ChatPage] Starting to fetch rooms');

        // URL 파라미터 먼저 확인 (email이나 roomId가 있으면 개인 공간을 기본 선택하지 않음)
        // window.location.href를 사용하여 최신 URL 파라미터 가져오기
        const urlParams = new URLSearchParams(window.location.search);
        const emailFromUrl = urlParams.get('email');
        const roomIdFromUrl = urlParams.get('roomId');
        const shouldSkipPersonalSpaceSelection = !!(emailFromUrl || roomIdFromUrl);
        
        console.log('[ChatPage] URL params check:', {
          emailFromUrl,
          roomIdFromUrl,
          shouldSkipPersonalSpaceSelection,
        });

        // 먼저 개인 공간이 존재하는지 확인 (생성/확인용)
        // 이 API는 개인 공간이 없으면 생성함
        let personalSpaceRoom: ChatRoom | null = null;
        try {
          const personalSpaceResponse = await fetch('/api/chat/personal-space');
          if (personalSpaceResponse.ok) {
            const personalSpaceData = await personalSpaceResponse.json();
            personalSpaceRoom = personalSpaceData.room;
            console.log('[ChatPage] Personal space room from API:', personalSpaceRoom?.id, personalSpaceRoom?.name);

            // 개인 공간을 store에 저장 (TeamsPage에서도 사용)
            if (personalSpaceRoom) {
              const roomForStore: ChatRoom = {
                id: personalSpaceRoom.id,
                name: personalSpaceRoom.name || '나만의 공간',
                type: 'DM',
                isPersonalSpace: true,
                members: personalSpaceRoom.members || [],
                lastMessage: personalSpaceRoom.lastMessage,
                updatedAt: personalSpaceRoom.updatedAt,
              };
              setPersonalSpaceRoom(roomForStore);
            }

            // 개인 공간을 즉시 rooms 배열에 추가 (선택은 조건부로)
            if (personalSpaceRoom) {
              // 개인 공간을 즉시 추가 (초기 로딩 시 빠른 표시를 위해)
              setRooms((prevRooms) => {
                // 중복 제거: 같은 ID를 가진 방이 여러 개 있으면 하나만 유지
                const uniquePrevRooms = prevRooms.reduce((acc: ChatRoom[], room: ChatRoom) => {
                  const existingRoom = acc.find(r => r.id === room.id);
                  if (!existingRoom) {
                    acc.push(room);
                  }
                  return acc;
                }, []);

                // 이미 개인 공간이 있으면 업데이트, 없으면 추가
                const hasPersonalSpace = uniquePrevRooms.some(r => r.isPersonalSpace);
                if (hasPersonalSpace) {
                  return uniquePrevRooms.map(r => r.isPersonalSpace ? personalSpaceRoom! : r);
                } else {
                  // 개인 공간을 맨 앞에 추가
                  return [personalSpaceRoom!, ...uniquePrevRooms];
                }
              });

              // URL 파라미터가 없을 때만 개인 공간을 기본으로 선택
              // (email이나 roomId가 있으면 나중에 처리될 때까지 선택하지 않음)
              if (!shouldSkipPersonalSpaceSelection) {
                console.log('[ChatPage] No URL params, will select personal space as default after rooms are loaded');
                // 개인 공간 선택은 모든 방이 로드된 후에 처리 (아래 코드에서)
              } else {
                console.log('[ChatPage] URL params detected, skipping personal space selection');
              }
            }
          } else {
            const errorData = await personalSpaceResponse.json().catch(() => ({}));
            console.error('[ChatPage] Failed to get personal space:', personalSpaceResponse.status, errorData);
          }
        } catch (error) {
          console.error('[ChatPage] Error fetching personal space:', error);
        }

        // DM 채팅방만 가져오기 (개인 공간 포함)
        console.log('[ChatPage] Calling /api/chat/rooms?type=DM...');
        const response = await fetch('/api/chat/rooms?type=DM');
        console.log('[ChatPage] Response status:', response.status, response.ok);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[ChatPage] Failed to fetch rooms:', response.status, errorText);
          setIsLoadingRooms(false);
          return;
        }

        const data = await response.json();
        console.log('[ChatPage] Response data:', data);
        let allRooms: ChatRoom[] = data.rooms || [];
        console.log('[ChatPage] Fetched rooms:', allRooms.length, 'rooms');
        console.log('[ChatPage] All room details:', allRooms.map(r => ({
          id: r.id,
          name: r.name,
          type: r.type,
          isPersonalSpace: r.isPersonalSpace,
          memberCount: r.members.length,
          memberEmails: r.members.map(m => m.email)
        })));
        console.log('[ChatPage] Rooms with personal space:', allRooms.filter(r => r.isPersonalSpace).length);
        console.log('[ChatPage] DM rooms (not personal space):', allRooms.filter(r => !r.isPersonalSpace).length);
        console.log('[ChatPage] DM rooms details:', allRooms.filter(r => !r.isPersonalSpace).map(r => ({
          id: r.id,
          name: r.name,
          members: r.members.map(m => ({ email: m.email, name: m.name }))
        })));

        // 개인 공간이 rooms 배열에 없으면 추가
        if (personalSpaceRoom) {
          const existingPersonalSpace = allRooms.find((r: ChatRoom) => r.isPersonalSpace);
          if (!existingPersonalSpace) {
            allRooms = [personalSpaceRoom, ...allRooms];
            console.log('[ChatPage] Added personal space to rooms array');
          } else {
            // 기존 개인 공간을 최신 정보로 업데이트
            allRooms = allRooms.map((r: ChatRoom) =>
              r.isPersonalSpace ? personalSpaceRoom! : r
            );
            console.log('[ChatPage] Updated existing personal space in rooms array');
          }
        }

        // 중복 제거: 같은 ID를 가진 방이 여러 개 있으면 하나만 유지
        const uniqueRooms = allRooms.reduce((acc: ChatRoom[], room: ChatRoom) => {
          const existingRoom = acc.find(r => r.id === room.id);
          if (!existingRoom) {
            acc.push(room);
          }
          return acc;
        }, []);

        setRooms(uniqueRooms);
        console.log('[ChatPage] Set rooms state:', uniqueRooms.length, 'rooms');

        // 개인 공간 찾기 (rooms 배열에서)
        const finalPersonalSpaceRoom = uniqueRooms.find((r: ChatRoom) => r.isPersonalSpace) || personalSpaceRoom;
        console.log('[ChatPage] Final personal space room:', finalPersonalSpaceRoom?.id, finalPersonalSpaceRoom?.name);

        // URL 파라미터 재확인 (이미 위에서 확인했지만 여기서도 확인)
        // window.location.href를 사용하여 최신 URL 파라미터 가져오기
        const currentUrlParams = new URLSearchParams(window.location.search);
        const currentRoomIdFromUrl = currentUrlParams.get('roomId');
        const currentEmailFromUrl = currentUrlParams.get('email');
        
        // email 파라미터가 있으면 나중에 처리될 때까지 선택하지 않음
        if (currentEmailFromUrl) {
          console.log('[ChatPage] Email param detected, skipping room selection (will be handled by email useEffect)');
          return;
        }

        // URL에서 roomId 읽어서 채팅방 선택
        if (currentRoomIdFromUrl) {
          const roomToSelect = uniqueRooms.find((r: ChatRoom) => r.id === currentRoomIdFromUrl && (r.isPersonalSpace || r.type === 'DM'));
          if (roomToSelect) {
            setSelectedRoom(roomToSelect);
            console.log('[ChatPage] Selected room from URL:', roomToSelect.id);
            return;
          }
        }

        // URL 파라미터가 없고 아직 방을 선택하지 않았을 때만 개인 공간 선택
        // email 파라미터가 있으면 선택하지 않음 (email 처리 useEffect에서 처리됨)
        if (!shouldSkipPersonalSpaceSelection && finalPersonalSpaceRoom && !selectedRoom) {
          console.log('[ChatPage] No URL params and no selected room, selecting personal space as default');
          setSelectedRoom(finalPersonalSpaceRoom);
          router.replace(`/chat?roomId=${finalPersonalSpaceRoom.id}`);
        } else if (shouldSkipPersonalSpaceSelection) {
          console.log('[ChatPage] URL params detected, skipping personal space selection');
        }
      } catch (error) {
        console.error('[ChatPage] Failed to fetch rooms:', error);
        setIsLoadingRooms(false);
      } finally {
        setIsLoadingRooms(false);
        console.log('[ChatPage] Loading completed, isLoadingRooms set to false');
      }
    };

    // user가 로드된 후에만 실행 (한 번만)
    fetchRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthLoading]); // hasFetchedRooms는 내부에서 관리하므로 dependency 제외

  // URL의 email 파라미터 처리: 해당 유저와의 DM 찾기 또는 생성
  // 우선순위를 높여서 먼저 처리 (개인 공간이 렌더링되기 전에)
  useEffect(() => {
    const emailFromUrl = searchParams.get('email');
    if (!emailFromUrl || !user) {
      return;
    }

    // 로딩 중이면 잠시 대기하되, 너무 오래 걸리지 않도록 처리
    if (isLoadingRooms) {
      // 방 목록이 아직 로딩 중이면 잠시 후 다시 시도 (최대 2초)
      const timeout = setTimeout(() => {
        console.log('[ChatPage] Rooms still loading, but proceeding with email DM');
      }, 2000);
      return () => clearTimeout(timeout);
    }

    const handleEmailDM = async () => {
      try {
        console.log('[ChatPage] Email parameter found, fetching DM for:', emailFromUrl);
        
        // 즉시 선택된 방을 null로 설정하여 개인 공간이 렌더링되지 않도록 함
        setSelectedRoom(null);
        
        const response = await fetch(`/api/chat/rooms?email=${encodeURIComponent(emailFromUrl)}`, {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          const dmRoom = data.rooms?.[0];
          
          if (dmRoom) {
            console.log('[ChatPage] DM room found/created:', dmRoom.id);
            
            // 방 목록에 추가 (없으면)
            setRooms((prevRooms) => {
              const exists = prevRooms.find(r => r.id === dmRoom.id);
              if (exists) {
                return prevRooms;
              }
              return [...prevRooms, dmRoom];
            });
            
            // 방 선택 및 URL 업데이트 (동시에 처리하여 깜빡임 방지)
            setSelectedRoom(dmRoom);
            router.replace(`/chat?roomId=${dmRoom.id}`);
          }
        } else {
          const error = await response.json();
          console.error('[ChatPage] Failed to fetch/create DM:', error);
          alert(error.error || 'DM을 생성할 수 없습니다.');
          // email 파라미터 제거하고 개인 공간으로 이동
          router.replace('/chat');
        }
      } catch (error) {
        console.error('[ChatPage] Error handling email DM:', error);
        router.replace('/chat');
      }
    };

    handleEmailDM();
  }, [searchParams, user, isLoadingRooms, router]);

  // URL의 roomId가 변경될 때만 선택된 방 업데이트 (방 목록은 다시 가져오지 않음)
  useEffect(() => {
    if (!rooms.length || !searchParams.get('roomId')) {
      return;
    }

    const roomIdFromUrl = searchParams.get('roomId');
    // email 파라미터가 있으면 roomId 처리를 건너뜀 (위의 useEffect에서 처리)
    if (searchParams.get('email')) {
      return;
    }

    const roomToSelect = rooms.find((r: ChatRoom) => r.id === roomIdFromUrl && (r.isPersonalSpace || r.type === 'DM'));
    
    if (roomToSelect && selectedRoom?.id !== roomToSelect.id) {
      console.log('[ChatPage] URL roomId changed, selecting room:', roomToSelect.id);
      setSelectedRoom(roomToSelect);
    }
  }, [searchParams, rooms, selectedRoom?.id]);


  // Fetch messages when room is selected
  useEffect(() => {
    if (!selectedRoom) {
      setMessages([]);
      return;
    }

    setIsLoadingMessages(true);
    
    const fetchMessages = async () => {
      try {
        console.log('[ChatPage] Fetching messages for room:', {
          roomId: selectedRoom.id,
          isPersonalSpace: selectedRoom.isPersonalSpace,
        });
        
        const response = await fetch(`/api/chat/messages?roomId=${selectedRoom.id}`);
        if (response.ok) {
          const data = await response.json();
          console.log('[ChatPage] Messages fetched:', {
            count: data.messages?.length || 0,
            messageIds: data.messages?.map((m: Message) => m.id) || [],
            userIds: data.messages?.map((m: Message) => m.userId) || [],
          });
          setMessages(data.messages || []);
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('[ChatPage] Failed to fetch messages:', {
            status: response.status,
            error: errorData,
          });
        }
      } catch (error) {
        console.error('[ChatPage] Error fetching messages:', error);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [selectedRoom]);

  // Join room when selected and socket is connected (개인 공간 제외)
  useEffect(() => {
    console.log('[ChatPage] Join room effect triggered:', {
      hasSelectedRoom: !!selectedRoom,
      selectedRoomId: selectedRoom?.id,
      selectedRoomName: selectedRoom?.name,
      isPersonalSpace: selectedRoom?.isPersonalSpace,
      hasSocket: !!socket,
      socketId: socket?.id,
      isConnected,
      isAuthenticated,
    });

    if (selectedRoom && socket && !selectedRoom.isPersonalSpace) {
      if (!isConnected || !isAuthenticated) {
        console.warn('[ChatPage] Socket not ready for joining room:', {
          isConnected,
          isAuthenticated,
        });
        return;
      }

      console.log('[ChatPage] Joining room:', selectedRoom.id, 'Socket ID:', socket.id);

      const handleJoinedRoom = (data: { roomId: string }) => {
        console.log('[ChatPage] Successfully joined room:', data.roomId);
      };

      const handleJoinError = (data: { message: string }) => {
        console.error('[ChatPage] Failed to join room:', data.message);
      };

      socket.on('joinedRoom', handleJoinedRoom);
      socket.on('error', handleJoinError);

      socket.emit('joinRoom', { roomId: selectedRoom.id });

      return () => {
        socket.off('joinedRoom', handleJoinedRoom);
        socket.off('error', handleJoinError);
      };
    } else {
      if (selectedRoom && selectedRoom.isPersonalSpace) {
        console.log('[ChatPage] Personal space, skipping room join');
      } else if (!socket) {
        console.warn('[ChatPage] No socket available, cannot join room');
      }
    }

    return () => {
      if (selectedRoom && socket && !selectedRoom.isPersonalSpace) {
        console.log('[ChatPage] Leaving room:', selectedRoom.id);
        socket.emit('leaveRoom', { roomId: selectedRoom.id });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom?.id, socket, isConnected, isAuthenticated]);

  // Listen for new messages
  useEffect(() => {
    if (!socket) return;

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
      console.log('[ChatPage] Received newMessage:', {
        messageId: data.id,
        roomId: data.chatRoomId,
        selectedRoomId: selectedRoom?.id,
        content: data.content,
        isPersonalSpace: selectedRoom?.isPersonalSpace,
      });

      // Personal Space의 경우 소켓 이벤트를 무시 (HTTP API로만 처리)
      if (selectedRoom?.isPersonalSpace && data.chatRoomId === selectedRoom?.id) {
        console.log('[ChatPage] Ignoring socket event for personal space (handled via HTTP API)');
        return;
      }

      const message: Message = {
        ...data,
        createdAt: typeof data.createdAt === 'string' ? data.createdAt : data.createdAt.toISOString(),
      };

      // 현재 선택된 방의 메시지만 추가 (알림은 NotificationProvider에서 처리)
      if (message.chatRoomId === selectedRoom?.id) {
        console.log('[ChatPage] Adding message to current room:', message.id);
        setMessages((prev) => {
          // 중복 체크 (더 엄격하게)
          const exists = prev.some(m => m.id === message.id);
          if (exists) {
            console.log('[ChatPage] Message already exists, skipping:', message.id);
            return prev;
          }
          console.log('[ChatPage] Adding new message:', message.id);
          return [...prev, message];
        });
      }
      // Update room list with new last message (Personal Space 제외)
      setRooms((prev) => {
        const targetRoom = prev.find(r => r.id === message.chatRoomId);
        if (targetRoom?.isPersonalSpace) {
          // Personal Space는 HTTP API로만 업데이트되므로 소켓 이벤트 무시
          return prev;
        }
        
        const updatedRooms = prev.map((room) =>
          room.id === message.chatRoomId
            ? {
                ...room,
                lastMessage: {
                  id: message.id,
                  content: message.content,
                  createdAt: message.createdAt,
                  user: {
                    id: message.user.id,
                    email: message.user.email,
                    name: message.user.name,
                  },
                },
                updatedAt: new Date().toISOString(),
              }
            : room
        );
        
        return updatedRooms;
      });
    };

    const handleRoomMessageUpdate = (data: {
      roomId: string;
      lastMessage: {
        id: string;
        content: string;
        createdAt: string;
        user: {
          id: string;
          email: string;
          name: string | null;
        };
      };
      updatedAt: string;
    }) => {
      // Personal Space의 경우 소켓 이벤트를 무시 (HTTP API로만 처리)
      setRooms((prev) => {
        const targetRoom = prev.find(r => r.id === data.roomId);
        if (targetRoom?.isPersonalSpace) {
          console.log('[ChatPage] Ignoring roomMessageUpdate for personal space (handled via HTTP API)');
          return prev;
        }

        // 채팅방 목록 업데이트 (알림은 NotificationProvider에서 처리)
        const updatedRooms = prev.map((room) =>
          room.id === data.roomId
            ? {
                ...room,
                lastMessage: data.lastMessage,
                updatedAt: data.updatedAt,
              }
            : room
        );
        
        return updatedRooms;
      });
    };

    const handleError = (data: { message: string }) => {
      console.error('Socket error:', data.message);
      // 사용자에게 에러 메시지 표시
      if (data.message === 'Not authenticated') {
        alert('인증이 필요합니다. 페이지를 새로고침해주세요.');
      } else if (data.message === 'Not a member of this room') {
        alert('이 채팅방의 멤버가 아닙니다.');
      } else {
        alert(`오류: ${data.message}`);
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
      if (data.chatRoomId === selectedRoom?.id) {
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
      if (data.roomId === selectedRoom?.id) {
        setMessages((prev) => prev.filter((msg) => msg.id !== data.messageId));
      }
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('messageSent', handleNewMessage);
    socket.on('roomMessageUpdate', handleRoomMessageUpdate);
    socket.on('messageUpdated', handleMessageUpdated);
    socket.on('messageDeleted', handleMessageDeleted);
    socket.on('error', handleError);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('messageSent', handleNewMessage);
      socket.off('roomMessageUpdate', handleRoomMessageUpdate);
      socket.off('messageUpdated', handleMessageUpdated);
      socket.off('messageDeleted', handleMessageDeleted);
      socket.off('error', handleError);
    };
  }, [socket, selectedRoom?.id, user?.id]);


  // Handle send message
  const handleSendMessage = async () => {
    if (!selectedRoom || !messageInput.trim()) {
      return;
    }

    const content = messageInput.trim();
    const roomId = selectedRoom.id;

    // 개인 공간의 경우 HTTP API 사용
    console.log('[ChatPage] Checking if personal space:', {
      isPersonalSpace: selectedRoom.isPersonalSpace,
      roomId,
      roomType: selectedRoom.type,
      memberCount: selectedRoom.members?.length,
    });
    
    if (selectedRoom.isPersonalSpace) {
      console.log('[ChatPage] Sending message to personal space via HTTP API:', {
        roomId,
        content: content.substring(0, 50),
      });
      
      try {
        const response = await fetch('/api/chat/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ roomId, content }),
        });

        console.log('[ChatPage] Personal space message response:', {
          status: response.status,
          ok: response.ok,
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[ChatPage] Personal space message saved:', {
            messageId: data.message?.id,
            roomId: data.message?.chatRoomId,
          });
          
          const message: Message = {
            ...data.message,
            createdAt: typeof data.message.createdAt === 'string'
              ? data.message.createdAt
              : new Date(data.message.createdAt).toISOString(),
          };

          // 메시지 목록에 추가 (중복 체크)
          setMessages((prev) => {
            const exists = prev.some(m => m.id === message.id);
            if (exists) {
              console.log('[ChatPage] Message already in list, skipping:', message.id);
              return prev;
            }
            console.log('[ChatPage] Adding message to list:', message.id);
            return [...prev, message];
          });

          // 채팅방 목록 업데이트
          setRooms((prev) =>
            prev.map((room) =>
              room.id === roomId
                ? {
                    ...room,
                    lastMessage: {
                      id: message.id,
                      content: message.content,
                      createdAt: message.createdAt,
                      user: {
                        id: message.user.id,
                        email: message.user.email,
                        name: message.user.name,
                      },
                    },
                    updatedAt: new Date().toISOString(),
                  }
                : room
            )
          );

          // Personal Space store도 업데이트
          if (selectedRoom.isPersonalSpace) {
            setPersonalSpaceRoom({
              ...selectedRoom,
              lastMessage: {
                id: message.id,
                content: message.content,
                createdAt: message.createdAt,
                user: {
                  id: message.user.id,
                  email: message.user.email,
                  name: message.user.name,
                },
              },
              updatedAt: new Date().toISOString(),
            });
          }

          setMessageInput('');
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[ChatPage] Failed to send personal space message:', {
            status: response.status,
            error: errorData,
          });
          alert(errorData.error || '메시지 전송에 실패했습니다.');
        }
      } catch (error) {
        console.error('[ChatPage] Error sending personal space message:', error);
        alert('메시지 전송에 실패했습니다.');
      }
      return;
    }

    // 설계:
    // 1. 둘 다 채팅방에 있으면 → Socket.io 사용 (양방향 실시간 통신)
    // 2. 한 사람만 있으면 → HTTP API 사용 (DB 저장만)
    // 
    // 클라이언트에서는 Socket이 연결되어 있으면 Socket.io 사용 시도
    // 서버에서 Room에 다른 사용자가 있으면 실시간 브로드캐스트, 없으면 DB 저장만

    const isSocketReady = socket && isConnected && isAuthenticated;

    console.log('[ChatPage] Message send decision:', {
      hasSocket: !!socket,
      socketId: socket?.id,
      isConnected,
      isAuthenticated,
      isSocketReady,
      roomId,
      content,
    });

    // Socket이 연결되어 있으면 Socket.io 사용
    // 서버에서 Room에 다른 사용자가 있으면 실시간 브로드캐스트, 없으면 DB 저장만
    if (isSocketReady) {
      console.log('[ChatPage] Using Socket.io (socket is ready)');
      socket.emit('sendMessage', {
        roomId,
        content,
      });
      setMessageInput('');
      return;
    }

    // Socket이 없으면 HTTP API 사용
    console.warn('[ChatPage] Using HTTP API (socket not ready)', {
      hasSocket: !!socket,
      isConnected,
      isAuthenticated,
      reason: !socket ? 'No socket' : !isConnected ? 'Not connected' : !isAuthenticated ? 'Not authenticated' : 'Unknown',
    });
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

        // 메시지 목록에 추가
        setMessages((prev) => [...prev, message]);

        // 채팅방 목록 업데이트
        setRooms((prev) =>
          prev.map((room) =>
            room.id === roomId
              ? {
                ...room,
                lastMessage: {
                  id: message.id,
                  content: message.content,
                  createdAt: message.createdAt,
                  user: {
                    id: message.user.id,
                    email: message.user.email,
                    name: message.user.name,
                  },
                },
                updatedAt: new Date().toISOString(),
              }
              : room
          )
        );

        setMessageInput('');
        console.log('[ChatPage] Message sent via HTTP API');
      } else {
        const error = await response.json();
        alert(error.error || '메시지 전송에 실패했습니다.');
      }
    } catch (error) {
      console.error('[ChatPage] Failed to send message via HTTP API:', error);
      alert('메시지 전송에 실패했습니다. 페이지를 새로고침해주세요.');
    }
  };

  // Handle create DM by email
  const handleCreateDM = async (email: string) => {
    try {
      const response = await fetch('/api/chat/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '채팅방 생성에 실패했습니다.');
      }

      const data = await response.json();
      const newRoom: ChatRoom = data.room;

      // Add the new room to the rooms list if it doesn't exist
      setRooms((prevRooms) => {
        const exists = prevRooms.some((r) => r.id === newRoom.id);
        if (exists) {
          return prevRooms.map((r) => (r.id === newRoom.id ? newRoom : r));
        }
        return [newRoom, ...prevRooms];
      });

      setSelectedRoom(newRoom);
      // URL 업데이트
      router.replace(`/chat?roomId=${newRoom.id}`);
    } catch (error) {
      console.error('Failed to create DM:', error);
      throw error; // Re-throw to let DMPanel handle the error
    }
  };


  return (
    <div className="chat-page-container">
      <Sidebar />
      <div className="chat-page-layout">
        <DMPanel
          rooms={rooms}
          selectedRoom={selectedRoom}
          user={user}
          isLoadingRooms={isLoadingRooms}
          onSelectRoom={(room) => {
            setSelectedRoom(room);
            // 개인 공간이 선택되면 rooms 배열에도 추가/업데이트
            if (room.isPersonalSpace) {
              setRooms((prevRooms) => {
                const existingIndex = prevRooms.findIndex((r) => r.isPersonalSpace);
                if (existingIndex >= 0) {
                  // 기존 개인 공간 업데이트
                  const updated = [...prevRooms];
                  updated[existingIndex] = room;
                  return updated;
                } else {
                  // 개인 공간이 없으면 맨 앞에 추가
                  return [room, ...prevRooms];
                }
              });
            }
            // URL 업데이트
            const currentRoomId = searchParams.get('roomId');
            if (currentRoomId !== room.id) {
              router.replace(`/chat?roomId=${room.id}`);
            }
          }}
          onCreateDM={handleCreateDM}
        />

        <div className="chat-area-panel">
          {selectedRoom ? (
            <ChatArea
              room={selectedRoom}
              messages={messages}
              messageInput={messageInput}
              user={user}
              isLoadingMessages={isLoadingMessages}
              onMessageInputChange={setMessageInput}
              onSendMessage={handleSendMessage}
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
              <p>채팅방을 선택하거나 새로 만들어주세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

