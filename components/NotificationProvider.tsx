'use client';

import { useEffect, useRef, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSocketStore } from '@/stores/useSocketStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNotificationStore } from '@/stores/useNotificationStore';

function NotificationProviderContent({ children }: { children: React.ReactNode }) {
  const { socket, isConnected, isAuthenticated } = useSocketStore();
  const { user } = useAuthStore();
  const { addNotification } = useNotificationStore();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 현재 보고 있는 방 ID를 추적하기 위한 ref
  // 리스너 내부에서 사용하므로 ref로 관리하여 리스너 재등록 방지
  const currentRoomIdRef = useRef<string | null>(null);

  // URL 변경 시 현재 방 ID 업데이트 (리스너 재등록 없이)
  useEffect(() => {
    if (pathname === '/chat') {
      currentRoomIdRef.current = searchParams.get('roomId');
    } else {
      currentRoomIdRef.current = null;
    }
  }, [pathname, searchParams]);

  // 전역 알림 리스너 설정 (한 번만 등록)
  useEffect(() => {
    console.log('[NotificationProvider] useEffect triggered:', {
      hasSocket: !!socket,
      isConnected,
      isAuthenticated,
      hasUser: !!user,
      userId: user?.id,
    });

    if (!socket || !isConnected || !isAuthenticated || !user) {
      console.log('[NotificationProvider] Missing requirements, not setting up listeners');
      return;
    }

    console.log('[NotificationProvider] Setting up global notification listener', {
      socketId: socket.id,
      userId: user.id,
    });

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
          profileImageUrl: string | null;
        };
      };
      updatedAt: string;
    }) => {
      const currentRoomId = currentRoomIdRef.current;
      const isOwnMessage = data.lastMessage.user.id === user.id;
      const isCurrentRoom = data.roomId === currentRoomId;

      console.log('[NotificationProvider] roomMessageUpdate received:', {
        roomId: data.roomId,
        currentRoomId,
        isOwnMessage,
        isCurrentRoom,
        shouldNotify: !isOwnMessage && !isCurrentRoom,
        userProfileImageUrl: data.lastMessage.user.profileImageUrl,
        userData: data.lastMessage.user,
        hasProfileImageUrl: 'profileImageUrl' in data.lastMessage.user,
        userKeys: Object.keys(data.lastMessage.user),
      });

      // 알림 조건: 본인 메시지가 아니고, 현재 보고 있는 방이 아닐 때
      if (!isOwnMessage && !isCurrentRoom) {
        // 채팅방 정보와 워크스페이스 정보를 알림 생성 시점에 동적으로 가져오기
        const getRoomInfo = async (roomId: string): Promise<{ teamName: string; roomName: string; teamId?: string; channelId?: string }> => {
          try {
            console.log('[NotificationProvider] Fetching room info for roomId:', roomId);
            // roomId로 직접 조회 (팀 채널 포함)
            const response = await fetch(`/api/chat/rooms?roomId=${roomId}`);
            if (response.ok) {
              const data = await response.json();
              const room = data.rooms?.[0]; // roomId로 조회하면 배열의 첫 번째 요소

              console.log('[NotificationProvider] Found room:', {
                roomId,
                found: !!room,
                room: room ? {
                  id: room.id,
                  type: room.type,
                  name: room.name,
                  isPersonalSpace: room.isPersonalSpace,
                  hasTeamChannel: !!room.teamChannel,
                  teamChannel: room.teamChannel,
                } : null,
              });

              if (!room) {
                console.warn('[NotificationProvider] Room not found in API response');
                return { teamName: '알 수 없음', roomName: '알 수 없음' };
              }

              // 팀 채널인 경우
              if (room.teamChannel) {
                console.log('[NotificationProvider] Team channel detected:', {
                  teamChannelId: room.teamChannel.id,
                  teamId: room.teamChannel.teamId,
                  channelName: room.teamChannel.name,
                });
                // 팀 정보 가져오기
                try {
                  const teamResponse = await fetch(`/api/teams/${room.teamChannel.teamId}`);
                  if (teamResponse.ok) {
                    const teamData = await teamResponse.json();
                    console.log('[NotificationProvider] Team info fetched:', teamData.team?.name);
                    const result = {
                      teamName: teamData.team?.name || '알 수 없음',
                      roomName: room.teamChannel.name || room.name || '채널',
                      teamId: room.teamChannel.teamId,
                      channelId: room.teamChannel.id,
                    };
                    console.log('[NotificationProvider] Returning team channel info:', result);
                    return result;
                  } else {
                    console.error('[NotificationProvider] Failed to fetch team info, status:', teamResponse.status);
                  }
                } catch (error) {
                  console.error('[NotificationProvider] Failed to fetch team info:', error);
                }
                const result = {
                  teamName: '알 수 없음',
                  roomName: room.teamChannel.name || room.name || '채널',
                  teamId: room.teamChannel.teamId,
                  channelId: room.teamChannel.id,
                };
                console.log('[NotificationProvider] Returning team channel info (fallback):', result);
                return result;
              }

              // 개인 공간인 경우
              if (room.isPersonalSpace) {
                console.log('[NotificationProvider] Personal space detected');
                return {
                  teamName: '개인 공간',
                  roomName: room.name || `${user?.name || user?.email || '사용자'}(나)`,
                };
              }

              // DM인 경우
              if (room.type === 'DM') {
                console.log('[NotificationProvider] DM detected, roomName:', room.name);
                return {
                  teamName: '다이렉트 메시지',
                  roomName: room.name || '알 수 없음',
                };
              }

              // 그룹 채팅방인 경우
              console.log('[NotificationProvider] Group chat detected, roomName:', room.name);
              return {
                teamName: '그룹 채팅',
                roomName: room.name || '채팅방',
              };
            } else {
              console.error('[NotificationProvider] Failed to fetch rooms, status:', response.status);
            }
          } catch (error) {
            console.error('[NotificationProvider] Failed to fetch room info:', error);
          }
          return { teamName: '알 수 없음', roomName: '알 수 없음' };
        };

        // 비동기로 채팅방 정보 가져와서 알림 생성
        getRoomInfo(data.roomId).then(async ({ teamName, roomName, teamId, channelId }) => {
          const senderName = data.lastMessage.user.name || data.lastMessage.user.email.split('@')[0];

          // 사용자 정보를 다시 조회해서 최신 프로필 이미지 URL 가져오기
          let userProfileImageUrl = data.lastMessage.user.profileImageUrl;
          try {
            const userResponse = await fetch(`/api/users/search?userId=${data.lastMessage.user.id}`);
            if (userResponse.ok) {
              const userData = await userResponse.json();
              if (userData.user?.profileImageUrl) {
                userProfileImageUrl = userData.user.profileImageUrl;
                console.log('[NotificationProvider] Fetched user profileImageUrl from API:', userProfileImageUrl);
              }
            }
          } catch (error) {
            console.error('[NotificationProvider] Failed to fetch user profileImageUrl:', error);
          }

          console.log('[NotificationProvider] Creating notification with room info:', {
            roomId: data.roomId,
            teamName,
            roomName,
            teamId,
            channelId,
            hasTeamId: !!teamId,
            hasChannelId: !!channelId,
            isTeamChannel: !!(teamId && channelId),
          });

          const notificationData: {
            id: string;
            type: 'message';
            title: string;
            roomName: string;
            message: string;
            roomId: string;
            userId: string;
            createdAt: string;
            read: boolean;
            user: {
              id: string;
              email: string;
              name: string | null;
              profileImageUrl: string | null;
            };
            teamId?: string;
            channelId?: string;
          } = {
            id: `msg-${data.lastMessage.id}`,
            type: 'message',
            title: teamName,
            roomName: roomName,
            message: `${senderName}: ${data.lastMessage.content}`,
            roomId: data.roomId,
            userId: data.lastMessage.user.id,
            createdAt: data.lastMessage.createdAt,
            read: false,
            user: {
              id: data.lastMessage.user.id,
              email: data.lastMessage.user.email,
              name: data.lastMessage.user.name,
              profileImageUrl: userProfileImageUrl ?? null,
            },
          };

          // teamId와 channelId가 있으면 명시적으로 추가
          if (teamId && channelId) {
            notificationData.teamId = teamId;
            notificationData.channelId = channelId;
            console.log('[NotificationProvider] Adding teamId and channelId to notification:', {
              teamId,
              channelId,
            });
          } else {
            console.log('[NotificationProvider] No teamId or channelId for notification:', {
              teamId,
              channelId,
              hasTeamId: !!teamId,
              hasChannelId: !!channelId,
              teamName,
              roomName,
            });
          }

          // 최종 알림 데이터 확인
          console.log('[NotificationProvider] Final notification data before adding:', {
            id: notificationData.id,
            type: notificationData.type,
            title: notificationData.title,
            roomName: notificationData.roomName,
            roomId: notificationData.roomId,
            teamId: notificationData.teamId,
            channelId: notificationData.channelId,
            hasTeamId: !!notificationData.teamId,
            hasChannelId: !!notificationData.channelId,
          });

          addNotification(notificationData);

          console.log('[NotificationProvider] Notification added:', {
            notificationId: `msg-${data.lastMessage.id}`,
            teamId: notificationData.teamId,
            channelId: notificationData.channelId,
            hasTeamId: !!notificationData.teamId,
            hasChannelId: !!notificationData.channelId,
          });
        });
      }
    };

    socket.on('roomMessageUpdate', handleRoomMessageUpdate);

    // Handle team invitation notifications
    const handleNotification = (data: {
      id: string;
      type: string;
      title: string;
      message: string;
      teamId?: string;
      teamName?: string;
      friendshipId?: string;
      createdAt: string;
      read: boolean;
      user?: {
        id: string;
        email: string;
        name: string | null;
        profileImageUrl: string | null;
      };
      [key: string]: unknown; // 추가 속성 허용
    }) => {
      console.log('[NotificationProvider] Notification received:', {
        id: data.id,
        type: data.type,
        title: data.title,
        message: data.message,
        friendshipId: data.friendshipId,
        teamId: data.teamId,
        hasUser: !!data.user,
        user: data.user,
        // 전체 데이터 확인
        allKeys: Object.keys(data),
        rawData: data,
      });

      // Handle team_invite and friend_request notifications
      if (data.type === 'team_invite') {
        console.log('[NotificationProvider] Adding team_invite notification');
        addNotification({
          id: data.id,
          type: 'team_invite',
          title: data.title,
          message: data.message,
          teamId: data.teamId,
          teamName: data.teamName,
          createdAt: data.createdAt,
          read: data.read,
          user: data.user,
        });
      } else if (data.type === 'friend_request') {
        // friendshipId를 명시적으로 추출
        let friendshipId: string | undefined = data.friendshipId;
        
        // friendshipId가 없으면 알림 ID에서 추출 시도 (형식: friend-request-{friendshipId})
        if (!friendshipId && data.id && typeof data.id === 'string' && data.id.startsWith('friend-request-')) {
          friendshipId = data.id.replace('friend-request-', '');
          console.log('[NotificationProvider] Extracted friendshipId from notification id:', friendshipId);
        }
        
        // 최종 확인: friendshipId가 여전히 없으면 에러 로그
        if (!friendshipId) {
          console.error('[NotificationProvider] Missing friendshipId in friend_request notification:', {
            id: data.id,
            type: data.type,
            friendshipId: data.friendshipId,
            friendshipIdType: typeof data.friendshipId,
            allKeys: Object.keys(data),
            rawData: JSON.stringify(data, null, 2),
          });
        }
        
        console.log('[NotificationProvider] Adding friend_request notification:', {
          id: data.id,
          friendshipId: friendshipId,
          hasFriendshipId: !!friendshipId,
          friendshipIdFromData: data.friendshipId,
          user: data.user,
          fullData: data,
          allKeys: Object.keys(data),
        });
        
        // friendshipId를 명시적으로 포함하여 알림 추가
        const notificationToAdd = {
          id: data.id,
          type: 'friend_request' as const,
          title: data.title,
          message: data.message,
          friendshipId: friendshipId, // 명시적으로 포함
          createdAt: data.createdAt,
          read: data.read,
          user: data.user,
        };
        
        console.log('[NotificationProvider] Notification object to add:', {
          ...notificationToAdd,
          friendshipId: notificationToAdd.friendshipId,
          hasFriendshipId: !!notificationToAdd.friendshipId,
        });
        
        addNotification(notificationToAdd);
        console.log('[NotificationProvider] Friend request notification added with friendshipId:', friendshipId);
      } else {
        console.log('[NotificationProvider] Unknown notification type:', data.type);
      }
    };

    socket.on('notification', handleNotification);

    console.log('[NotificationProvider] Socket listeners registered');

    return () => {
      console.log('[NotificationProvider] Cleaning up notification listeners');
      socket.off('roomMessageUpdate', handleRoomMessageUpdate);
      socket.off('notification', handleNotification);
    };
  }, [socket, isConnected, isAuthenticated, user, addNotification]);

  // 소켓 연결 상태 모니터링
  useEffect(() => {
    if (socket) {
      const handleConnect = () => {
        console.log('[NotificationProvider] Socket connected');
      };
      const handleDisconnect = () => {
        console.log('[NotificationProvider] Socket disconnected');
      };
      const handleError = (data: { message: string }) => {
        console.error('[NotificationProvider] Socket error:', data.message);
      };

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('error', handleError);

      return () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('error', handleError);
      };
    }
  }, [socket]);

  return <>{children}</>;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<>{children}</>}>
      <NotificationProviderContent>{children}</NotificationProviderContent>
    </Suspense>
  );
}
