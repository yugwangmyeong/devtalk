import { create } from 'zustand';
import type { Team } from '@/components/teams/TeamPanel';

interface TeamViewStore {
  isOpen: boolean;
  isChannelsPanelOpen: boolean;
  selectedTeam: Team | null;
  openTeamView: () => void;
  closeTeamView: () => void;
  toggleTeamView: () => void;
  selectTeam: (team: Team | null) => void;
  openChannelsPanel: () => void;
  closeChannelsPanel: () => void;
  toggleChannelsPanel: () => void;
}

export const useTeamViewStore = create<TeamViewStore>((set) => ({
  isOpen: false,
  isChannelsPanelOpen: false,
  selectedTeam: null,
  openTeamView: () => set({ isOpen: true }),
  closeTeamView: () => set({ isOpen: false }),
  toggleTeamView: () => set((state) => ({ isOpen: !state.isOpen })),
  selectTeam: (team) => set({ 
    selectedTeam: team,
    isChannelsPanelOpen: team !== null, // 워크스페이스 선택 시 채널 패널 자동 열기
  }),
  openChannelsPanel: () => set({ isChannelsPanelOpen: true }),
  closeChannelsPanel: () => set({ isChannelsPanelOpen: false }),
  toggleChannelsPanel: () => set((state) => ({ isChannelsPanelOpen: !state.isChannelsPanelOpen })),
}));

