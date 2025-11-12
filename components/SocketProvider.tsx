'use client';

import { useEffect } from 'react';
import { useSocketStore } from '@/stores/useSocketStore';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { connect, disconnect } = useSocketStore();

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  return <>{children}</>;
}

