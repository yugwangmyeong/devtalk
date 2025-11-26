'use client';

import { useEffect } from 'react';
import { useSocketStore } from '@/stores/useSocketStore';
import { useAuthStore } from '@/stores/useAuthStore';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { connect, disconnect, socket } = useSocketStore();
  const { isAuthenticated, user, isLoading: isAuthLoading } = useAuthStore();

  // 컴포넌트 마운트 확인
  useEffect(() => {
    // console.log('[SocketProvider] Component mounted');
  }, []);

  useEffect(() => {
    // console.log('[SocketProvider] useEffect triggered:', {
    //   isAuthenticated,
    //   hasUser: !!user,
    //   userId: user?.id,
    //   isAuthLoading,
    // });

    // 인증 로딩 중이면 기다림
    if (isAuthLoading) {
      // console.log('[SocketProvider] Auth still loading, waiting...');
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
        // console.log('[SocketProvider] Token found:', !!token);
        
        if (token) {
          // console.log('[SocketProvider] Calling connect()...');
          connect(token);
        } else {
          // console.warn('[SocketProvider] No token found');
        }
      });
    } else {
      // console.log('[SocketProvider] Not authenticated or no user, skipping connection', {
      //   isAuthenticated,
      //   hasUser: !!user,
      // });
    }

    return () => {
      // console.log('[SocketProvider] Cleanup: disconnecting socket');
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, isAuthLoading]); // Reconnect when auth state changes

  // Listen for friendsUpdated event from server (notification은 NotificationProvider에서 처리)
  useEffect(() => {
    if (!socket) {
      return;
    }

    // Listen for friendsUpdated event from server
    const handleFriendsUpdated = () => {
      // console.log('[SocketProvider] friendsUpdated event received from server');
      // Convert Socket.IO event to window event for FriendsPanel
      window.dispatchEvent(new CustomEvent('friendsUpdated'));
    };
    socket.on('friendsUpdated', handleFriendsUpdated);
    
    // console.log('[SocketProvider] friendsUpdated listener registered for socket:', socket.id);

    return () => {
      // console.log('[SocketProvider] Cleaning up friendsUpdated listener');
      socket.off('friendsUpdated', handleFriendsUpdated);
    };
  }, [socket]);

  return <>{children}</>;
}

