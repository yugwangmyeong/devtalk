'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
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
  const [hasLoadedNotifications, setHasLoadedNotifications] = useState(false);


  const currentRoomIdRef = useRef<string | null>(null);


  useEffect(() => {
    if (pathname === '/chat') {
      const roomIdFromUrl = searchParams.get('roomId');
    
      if (!currentRoomIdRef.current && roomIdFromUrl) {
        currentRoomIdRef.current = roomIdFromUrl;
        console.log('[NotificationProvider] Current room ID updated from URL (chat):', roomIdFromUrl);
      }
    } else if (pathname === '/teams') {
     
      console.log('[NotificationProvider] On teams page, room ID managed by events');
    } else {
     
      currentRoomIdRef.current = null;
      console.log('[NotificationProvider] Not on chat/teams page, clearing room ID');
    }
  }, [pathname, searchParams]);

 
  useEffect(() => {
    const handleRoomChange = (event: CustomEvent<{ roomId: string | null }>) => {
      const newRoomId = event.detail.roomId;
      console.log('[NotificationProvider] Room changed via event:', newRoomId);
      currentRoomIdRef.current = newRoomId;
    };

    window.addEventListener('currentRoomChanged', handleRoomChange as EventListener);
    return () => {
      window.removeEventListener('currentRoomChanged', handleRoomChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!user || hasLoadedNotifications) {
      return;
    }

    const loadNotifications = async () => {
      try {
        // console.log('[NotificationProvider] Loading saved notifications from database...');
        const response = await fetch('/api/notifications?unreadOnly=false&limit=50');
        if (response.ok) {
          const data = await response.json();
          const notifications = data.notifications || [];
          // console.log('[NotificationProvider] Loaded notifications from DB:', notifications.length);
          

          notifications.forEach((notification: any) => {
            addNotification(notification);
          });
          
          setHasLoadedNotifications(true);
        } else {
          console.error('[NotificationProvider] Failed to load notifications:', response.status);
        }
      } catch (error) {
        console.error('[NotificationProvider] Error loading notifications:', error);
      }
    };

    loadNotifications();
  }, [user, hasLoadedNotifications, addNotification]);


  useEffect(() => {
    console.log('[NotificationProvider] useEffect triggered:', {
      hasSocket: !!socket,
      isConnected,
      isAuthenticated,
      hasUser: !!user,
      userId: user?.id,
    });

    if (!socket || !isConnected || !isAuthenticated || !user) {
      console.log('[NotificationProvider] Missing requirements, not setting up listeners', {
        hasSocket: !!socket,
        isConnected,
        isAuthenticated,
        hasUser: !!user,
      });
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
        userId: user.id,
        messageUserId: data.lastMessage.user.id,
      });

     
      if (!isOwnMessage && !isCurrentRoom) {
        console.log('[NotificationProvider] Creating notification for message');
      
        const getRoomInfo = async (roomId: string): Promise<{ teamName: string; roomName: string; teamId?: string; channelId?: string }> => {
          try {
            // console.log('[NotificationProvider] Fetching room info for roomId:', roomId);
            const response = await fetch(`/api/chat/rooms?roomId=${roomId}`);
            if (response.ok) {
              const data = await response.json();
              const room = data.rooms?.[0];

              // console.log('[NotificationProvider] Found room:', {
              //   roomId,
              //   found: !!room,
              //   room: room ? {
              //     id: room.id,
              //     type: room.type,
              //     name: room.name,
              //     isPersonalSpace: room.isPersonalSpace,
              //     hasTeamChannel: !!room.teamChannel,
              //     teamChannel: room.teamChannel,
              //   } : null,
              // });

              if (!room) {
                console.warn('[NotificationProvider] Room not found in API response');
                return { teamName: '알 수 없음', roomName: '알 수 없음' };
              }

              if (room.teamChannel) {
                // console.log('[NotificationProvider] Team channel detected:', {
                //   teamChannelId: room.teamChannel.id,
                //   teamId: room.teamChannel.teamId,
                //   channelName: room.teamChannel.name,
                // });
                try {
                  const teamResponse = await fetch(`/api/teams/${room.teamChannel.teamId}`);
                  if (teamResponse.ok) {
                    const teamData = await teamResponse.json();
                    // console.log('[NotificationProvider] Team info fetched:', teamData.team?.name);
                    const result = {
                      teamName: teamData.team?.name || '알 수 없음',
                      roomName: room.teamChannel.name || room.name || '채널',
                      teamId: room.teamChannel.teamId,
                      channelId: room.teamChannel.id,
                    };
                    // console.log('[NotificationProvider] Returning team channel info:', result);
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
                // console.log('[NotificationProvider] Returning team channel info (fallback):', result);
                return result;
              }

              if (room.isPersonalSpace) {
                // console.log('[NotificationProvider] Personal space detected');
                return {
                  teamName: '개인 공간',
                  roomName: room.name || `${user?.name || user?.email || '사용자'}(나)`,
                };
              }

              if (room.type === 'DM') {
                // console.log('[NotificationProvider] DM detected, roomName:', room.name);
                return {
                  teamName: '다이렉트 메시지',
                  roomName: room.name || '알 수 없음',
                };
              }

              // console.log('[NotificationProvider] Group chat detected, roomName:', room.name);
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


        getRoomInfo(data.roomId).then(async ({ teamName, roomName, teamId, channelId }) => {
          const senderName = data.lastMessage.user.name || data.lastMessage.user.email.split('@')[0];

          let userProfileImageUrl = data.lastMessage.user.profileImageUrl;
          try {
            const userResponse = await fetch(`/api/users/search?userId=${data.lastMessage.user.id}`);
            if (userResponse.ok) {
              const userData = await userResponse.json();
              if (userData.user?.profileImageUrl) {
                userProfileImageUrl = userData.user.profileImageUrl;
                // console.log('[NotificationProvider] Fetched user profileImageUrl from API:', userProfileImageUrl);
              }
            }
          } catch (error) {
            console.error('[NotificationProvider] Failed to fetch user profileImageUrl:', error);
          }

          // console.log('[NotificationProvider] Creating notification with room info:', {
          //   roomId: data.roomId,
          //   teamName,
          //   roomName,
          //   teamId,
          //   channelId,
          //   hasTeamId: !!teamId,
          //   hasChannelId: !!channelId,
          //   isTeamChannel: !!(teamId && channelId),
          // });

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

          if (teamId && channelId) {
            notificationData.teamId = teamId;
            notificationData.channelId = channelId;
            // console.log('[NotificationProvider] Adding teamId and channelId to notification:', {
            //   teamId,
            //   channelId,
            // });
          } else {
            // console.log('[NotificationProvider] No teamId or channelId for notification:', {
            //   teamId,
            //   channelId,
            //   hasTeamId: !!teamId,
            //   hasChannelId: !!channelId,
            //   teamName,
            //   roomName,
            // });
          }

          // console.log('[NotificationProvider] Final notification data before adding:', {
          //   id: notificationData.id,
          //   type: notificationData.type,
          //   title: notificationData.title,
          //   roomName: notificationData.roomName,
          //   roomId: notificationData.roomId,
          //   teamId: notificationData.teamId,
          //   channelId: notificationData.channelId,
          //   hasTeamId: !!notificationData.teamId,
          //   hasChannelId: !!notificationData.channelId,
          // });

          addNotification(notificationData);

          console.log('[NotificationProvider] Notification added:', {
            notificationId: `msg-${data.lastMessage.id}`,
            teamId: notificationData.teamId,
            channelId: notificationData.channelId,
            hasTeamId: !!notificationData.teamId,
            hasChannelId: !!notificationData.channelId,
          });
        }).catch((error) => {
          console.error('[NotificationProvider] Error creating notification:', error);
        });
      } else {
        console.log('[NotificationProvider] Skipping notification:', {
          isOwnMessage,
          isCurrentRoom,
          roomId: data.roomId,
        });
      }
    };

    socket.on('roomMessageUpdate', handleRoomMessageUpdate);
    console.log('[NotificationProvider] roomMessageUpdate listener registered');

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
      [key: string]: unknown;
    }) => {
      console.log('[NotificationProvider] ========== NOTIFICATION RECEIVED ==========');
      console.log('[NotificationProvider] Notification received:', {
        id: data.id,
        type: data.type,
        title: data.title,
        message: data.message,
        friendshipId: data.friendshipId,
        teamId: data.teamId,
        hasUser: !!data.user,
        user: data.user,
        allKeys: Object.keys(data),
        rawData: JSON.stringify(data, null, 2),
      });
      console.log('[NotificationProvider] ===========================================');

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
        let friendshipId: string | undefined = data.friendshipId;

        if (!friendshipId && data.id && typeof data.id === 'string' && data.id.startsWith('friend-request-')) {
          friendshipId = data.id.replace('friend-request-', '');
          // console.log('[NotificationProvider] Extracted friendshipId from notification id:', friendshipId);
        }
        
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
        
        
        const notificationToAdd = {
          id: data.id,
          type: 'friend_request' as const,
          title: data.title,
          message: data.message,
          friendshipId: friendshipId,
          createdAt: data.createdAt,
          read: data.read,
          user: data.user,
        };
        

        
        addNotification(notificationToAdd);
     
      } else {
  
      }
    };

    socket.on('notification', handleNotification);
    console.log('[NotificationProvider] notification listener registered');

    console.log('[NotificationProvider] Socket listeners registered');

    return () => {
      console.log('[NotificationProvider] Cleaning up notification listeners');
      socket.off('roomMessageUpdate', handleRoomMessageUpdate);
      socket.off('notification', handleNotification);
    };
  }, [socket, isConnected, isAuthenticated, user, addNotification]);


  useEffect(() => {
    if (socket) {
      const handleConnect = () => {
        // console.log('[NotificationProvider] Socket connected');
      };
      const handleDisconnect = () => {
        // console.log('[NotificationProvider] Socket disconnected');
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
