'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoginPage } from '@/components/Auth/LoginPage';
import { MainPage } from '@/components/MainPage';
import { useAuthStore } from '@/stores/useAuthStore';

export default function Home() {
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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  return isAuthenticated ? <MainPage /> : <LoginPage />;
}
