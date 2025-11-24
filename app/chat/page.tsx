'use client';

import { Suspense } from 'react';
import { ChatPage } from '@/components/ChatPage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function Chat() {
  return (
    <Suspense fallback={<LoadingSpinner size="large" message="로딩 중..." fullScreen />}>
      <ChatPage />
    </Suspense>
  );
}

