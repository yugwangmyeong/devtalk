'use client';

import './css/MainLayout.css';
import { Sidebar } from './Sidebar';
import { useTeamViewStore } from '@/stores/useTeamViewStore';

interface MainLayoutProps {
  children: React.ReactNode;
  headerTitle?: string;
}

export function MainLayout({ children, headerTitle = '메인화면' }: MainLayoutProps) {
  const { selectedTeam } = useTeamViewStore();

  return (
    <div className="main-layout">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="main-header">
          <h1 className="main-header-title">
            {selectedTeam ? selectedTeam.name : headerTitle}
          </h1>
        </header>

        {/* Content Area */}
        <div className="main-content-area">
          <div className="main-content-wrapper">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

