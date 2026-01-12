'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { useTeamViewStore } from '@/stores/useTeamViewStore';
import { FriendsPanel } from '@/components/friends/FriendsPanel';
import { UpcomingEventsSection } from '@/components/dashboard/UpcomingEventsSection';
import { TeamActivitiesSection } from '@/components/dashboard/TeamActivitiesSection';
import { TasksAnnouncementsSection } from '@/components/dashboard/TasksAnnouncementsSection';
import './MainPage.css';

interface DashboardData {
  upcomingEvents: any[];
  teamActivities: any[];
  announcements: any[];
}

export function MainPage() {
  const { selectTeam, closeChannelsPanel } = useTeamViewStore();
  const [isFriendsPanelOpen, setIsFriendsPanelOpen] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    upcomingEvents: [],
    teamActivities: [],
    announcements: [],
  });
  const [isLoading, setIsLoading] = useState(true);


  useEffect(() => {
    selectTeam(null);
    closeChannelsPanel();
    setIsFriendsPanelOpen(true);
  }, [selectTeam, closeChannelsPanel]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/dashboard');
        if (response.ok) {
          const data = await response.json();
          setDashboardData({
            upcomingEvents: data.upcomingEvents || [],
            teamActivities: data.teamActivities || [],
            announcements: data.announcements || [],
          });
        } else {
          console.error('Failed to fetch dashboard data');
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <>
      <div className={isFriendsPanelOpen ? 'main-content-with-friends' : ''}>
        <MainLayout headerTitle="DevTalk">
          <div className="main-page-content">

            <div className="dashboard-container">
              <TasksAnnouncementsSection 
                announcements={dashboardData.announcements}
                isLoading={isLoading}
              />


              <div className="dashboard-grid">
                <UpcomingEventsSection
                  events={dashboardData.upcomingEvents}
                  isLoading={isLoading}
                />
                <TeamActivitiesSection
                  activities={dashboardData.teamActivities}
                  isLoading={isLoading}
                />
              </div>
            </div>
          </div>
        </MainLayout>
      </div>
      

      {isFriendsPanelOpen && (
        <div className="friends-panel-sidebar-attached">
          <FriendsPanel
            isOpen={true}
            onClose={() => setIsFriendsPanelOpen(false)}
          />
        </div>
      )}
    </>
  );
}

