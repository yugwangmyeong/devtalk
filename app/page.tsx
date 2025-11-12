'use client';

import { useEffect } from 'react';
import { LoginPage } from '@/components/Auth/LoginPage';
import { MainPage } from '@/components/MainPage';
import { useAuthStore } from '@/stores/useAuthStore';

export default function Home() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">로딩 중...</div>
      </div>
    );
  }

  return isAuthenticated ? <MainPage /> : <LoginPage />;
}
