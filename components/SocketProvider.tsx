'use client';

import { useEffect } from 'react';
import { useSocketStore } from '@/stores/useSocketStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNotificationStore } from '@/stores/useNotificationStore';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { connect, disconnect, socket } = useSocketStore();
  const { isAuthenticated, user, isLoading: isAuthLoading } = useAuthStore();
  const { addNotification } = useNotificationStore();

  // 컴포넌트 마운트 확인
  useEffect(() => {
    console.log('[SocketProvider] Component mounted');
  }, []);

  useEffect(() => {
    console.log('[SocketProvider] useEffect triggered:', {
      isAuthenticated,
      hasUser: !!user,
      userId: user?.id,
      isAuthLoading,
    });

    // 인증 로딩 중이면 기다림
    if (isAuthLoading) {
      console.log('[SocketProvider] Auth still loading, waiting...');
      return;
    }

    if (isAuthenticated && user) {
      // Get token from API (since cookie is httpOnly, we can't read it from document.cookie)
      const getToken = async () => {
        try {
          const response = await fetch('/api/auth/token', {
            credentials: 'include', // Include cookies in request
          });
          
          if (response.ok) {
            const data = await response.json();
            return data.token || null;
          }
          return null;
        } catch (error) {
          console.error('[SocketProvider] Failed to get token:', error);
          return null;
        }
      };

      getToken().then((token) => {
        console.log('[SocketProvider] Token found:', !!token);
        
        if (token) {
          console.log('[SocketProvider] Calling connect()...');
          connect(token);
        } else {
          console.warn('[SocketProvider] No token found');
        }
      });
    } else {
      console.log('[SocketProvider] Not authenticated or no user, skipping connection', {
        isAuthenticated,
        hasUser: !!user,
      });
    }

    return () => {
      console.log('[SocketProvider] Cleanup: disconnecting socket');
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, isAuthLoading]); // Reconnect when auth state changes

  // Listen for notifications
  useEffect(() => {
    if (!socket) {
      console.log('[SocketProvider] No socket, skipping notification listener setup');
      return;
    }

    console.log('[SocketProvider] Setting up notification listener', {
      socketId: socket.id,
      isConnected: socket.connected,
    });

    const handleNotification = (data: {
      id: string;
      type: string;
      title: string;
      message: string;
      teamId?: string;
      teamName?: string;
      roomId?: string;
      userId?: string;
      friendshipId?: string; // 친구 요청 ID 추가
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
      console.log('[SocketProvider] Received notification:', {
        ...data,
        friendshipId: data.friendshipId,
        hasFriendshipId: !!data.friendshipId,
        allKeys: Object.keys(data),
      });
      console.log('[SocketProvider] Notification type:', data.type);
      console.log('[SocketProvider] Adding notification to store...');
      
      // friendshipId를 명시적으로 포함하여 알림 추가
      addNotification({
        id: data.id,
        type: data.type as any,
        title: data.title,
        message: data.message,
        teamId: data.teamId,
        teamName: data.teamName,
        roomId: data.roomId,
        userId: data.userId,
        friendshipId: data.friendshipId, // friendshipId 명시적으로 포함
        createdAt: data.createdAt,
        read: data.read,
        user: data.user,
      });
      console.log('[SocketProvider] Notification added to store with friendshipId:', data.friendshipId);
    };

    // Register notification listener
    socket.on('notification', handleNotification);
    
    // Listen for friendsUpdated event from server
    const handleFriendsUpdated = () => {
      console.log('[SocketProvider] friendsUpdated event received from server');
      // Convert Socket.IO event to window event for FriendsPanel
      window.dispatchEvent(new CustomEvent('friendsUpdated'));
    };
    socket.on('friendsUpdated', handleFriendsUpdated);
    
    console.log('[SocketProvider] Notification and friendsUpdated listeners registered for socket:', socket.id);
    
    // Debug: Log all events to see what's being received
    const debugHandler = (eventName: string, ...args: any[]) => {
      if (eventName === 'notification') {
        console.log('[SocketProvider] DEBUG: notification event received directly:', args);
      }
    };
    
    // Listen to all events for debugging
    socket.onAny((eventName, ...args) => {
      console.log('[SocketProvider] DEBUG: Received event:', eventName, args);
      if (eventName === 'notification') {
        console.log('[SocketProvider] DEBUG: notification event detected via onAny');
      }
    });

    return () => {
      console.log('[SocketProvider] Cleaning up notification and friendsUpdated listeners');
      socket.off('notification', handleNotification);
      socket.off('friendsUpdated', handleFriendsUpdated);
      socket.offAny();
    };
  }, [socket, addNotification]);

  return <>{children}</>;
}

