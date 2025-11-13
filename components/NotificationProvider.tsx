'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSocketStore } from '@/stores/useSocketStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNotificationStore } from '@/stores/useNotificationStore';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
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
    if (!socket || !isConnected || !isAuthenticated || !user) {
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
      });

      // 알림 조건: 본인 메시지가 아니고, 현재 보고 있는 방이 아닐 때
      if (!isOwnMessage && !isCurrentRoom) {
        // 채팅방 이름은 알림 생성 시점에 동적으로 가져오기
        const getRoomName = async (roomId: string): Promise<string> => {
          try {
            const response = await fetch('/api/chat/rooms');
            if (response.ok) {
              const data = await response.json();
              const room = data.rooms?.find((r: any) => r.id === roomId);
              if (!room) return '알 수 없음';
              
              if (room.isPersonalSpace) {
                return `${user?.name || user?.email || '사용자'}(나)`;
              }
              
              if (room.type === 'DM') {
                const otherMember = room.members?.find((m: any) => m.id !== user?.id);
                return otherMember?.name || otherMember?.email || '알 수 없음';
              }
              
              return room.name || '채팅방';
            }
          } catch (error) {
            console.error('[NotificationProvider] Failed to fetch room name:', error);
          }
          return '알 수 없음';
        };

        // 비동기로 채팅방 이름 가져와서 알림 생성
        getRoomName(data.roomId).then((roomName) => {
          const senderName = data.lastMessage.user.name || data.lastMessage.user.email.split('@')[0];
          
          addNotification({
            id: `msg-${data.lastMessage.id}`,
            type: 'message',
            title: roomName,
            message: `${senderName}: ${data.lastMessage.content}`,
            roomId: data.roomId,
            userId: data.lastMessage.user.id,
            createdAt: data.lastMessage.createdAt,
            read: false,
            user: {
              id: data.lastMessage.user.id,
              email: data.lastMessage.user.email,
              name: data.lastMessage.user.name,
              profileImageUrl: null,
            },
          });
        });
      }
    };

    socket.on('roomMessageUpdate', handleRoomMessageUpdate);

    return () => {
      console.log('[NotificationProvider] Cleaning up notification listener');
      socket.off('roomMessageUpdate', handleRoomMessageUpdate);
    };
  }, [socket, isConnected, isAuthenticated, user, addNotification]);

  return <>{children}</>;
}
