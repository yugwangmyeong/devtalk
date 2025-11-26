'use client';

import { Suspense } from 'react';
import { TeamsPage } from '@/components/teams/TeamsPage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function Teams() {
  return (
    <Suspense fallback={<LoadingSpinner size="large" message="로딩 중..." fullScreen />}>
      <TeamsPage />
    </Suspense>
  );
}

