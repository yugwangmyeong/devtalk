import { create } from 'zustand';
import type { Notification } from '@/types/notification';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isOpen: boolean;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
}

const MAX_NOTIFICATIONS = 50;

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,

  addNotification: (notification: Notification) => {
    console.log('[NotificationStore] addNotification called:', notification);
    set((state) => {
      // 중복 체크: 같은 ID의 알림이 이미 있으면 추가하지 않음
      const existingNotification = state.notifications.find((n) => n.id === notification.id);
      if (existingNotification) {
        console.log('[NotificationStore] Duplicate notification, skipping:', notification.id);
        return state;
      }

      // 새 알림 추가 (최대 개수 제한)
      const newNotifications = [notification, ...state.notifications].slice(0, MAX_NOTIFICATIONS);
      
      console.log('[NotificationStore] Notification added, new count:', newNotifications.length, 'unread:', state.unreadCount + 1);
      
      return {
        notifications: newNotifications,
        unreadCount: state.unreadCount + 1,
      };
    });
  },

  markAsRead: (id: string) => {
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      if (!notification || notification.read) {
        return state;
      }

      return {
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    });
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  removeNotification: (id: string) => {
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      const wasUnread = notification && !notification.read;

      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
      };
    });
  },

  clearAll: () => {
    set({
      notifications: [],
      unreadCount: 0,
    });
  },

  togglePanel: () => {
    set((state) => ({ isOpen: !state.isOpen }));
  },

  openPanel: () => {
    set({ isOpen: true });
  },

  closePanel: () => {
    set({ isOpen: false });
  },
}));

