'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoginPage } from '@/components/Auth/LoginPage';
import { MainPage } from '@/components/MainPage';
import { useAuthStore } from '@/stores/useAuthStore';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

function HomeContent() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check auth on mount
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    // If Google auth success, refresh auth state
    const googleAuth = searchParams.get('google_auth');
    if (googleAuth === 'success') {
      checkAuth();
      // Clean up URL
      window.history.replaceState({}, '', '/');
    }
  }, [searchParams, checkAuth]);

  if (isLoading) {
    return <LoadingSpinner size="large" message="DevTalk에 접속하는 중..." fullScreen />;
  }

  return isAuthenticated ? <MainPage /> : <LoginPage />;
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingSpinner size="large" message="DevTalk에 접속하는 중..." fullScreen />}>
      <HomeContent />
    </Suspense>
  );
}
