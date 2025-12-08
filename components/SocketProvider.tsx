'use client';

import { useEffect } from 'react';
import { useSocketStore } from '@/stores/useSocketStore';
import { useAuthStore } from '@/stores/useAuthStore';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { connect, disconnect, socket } = useSocketStore();
  const { isAuthenticated, user, isLoading: isAuthLoading } = useAuthStore();


  useEffect(() => {
    // console.log('[SocketProvider] Component mounted');
  }, []);

  useEffect(() => {

    if (isAuthLoading) {
      // console.log('[SocketProvider] Auth still loading, waiting...');
      return;
    }

    if (isAuthenticated && user) {
      const getToken = async () => {
        try {
          const response = await fetch('/api/auth/token', {
            credentials: 'include',
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
  }, [isAuthenticated, user?.id, isAuthLoading]); // Reconnect when auth state changes

 
  useEffect(() => {
    if (!socket) {
      return;
    }

   
    const handleFriendsUpdated = () => {
     
      window.dispatchEvent(new CustomEvent('friendsUpdated'));
    };
    socket.on('friendsUpdated', handleFriendsUpdated);
    
    

    return () => {
     
      socket.off('friendsUpdated', handleFriendsUpdated);
    };
  }, [socket]);

  return <>{children}</>;
}

