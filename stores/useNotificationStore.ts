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
  removeNotificationByFriendshipId: (friendshipId: string) => void;
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
    console.log('[NotificationStore] addNotification called:', {
      ...notification,
      friendshipId: notification.friendshipId,
      hasFriendshipId: !!notification.friendshipId,
    });
    set((state) => {
      
      const existingNotification = state.notifications.find((n) => n.id === notification.id);
      if (existingNotification) {
        console.log('[NotificationStore] Duplicate notification, skipping:', notification.id);
        return state;
      }

     
      const notificationToAdd: Notification = {
        ...notification,
        friendshipId: notification.friendshipId,
      };
      const newNotifications = [notificationToAdd, ...state.notifications].slice(0, MAX_NOTIFICATIONS);
      
      console.log('[NotificationStore] Notification added:', {
        id: notificationToAdd.id,
        type: notificationToAdd.type,
        friendshipId: notificationToAdd.friendshipId,
        hasFriendshipId: !!notificationToAdd.friendshipId,
        newCount: newNotifications.length,
      });
      
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
    console.log('[NotificationStore] removeNotification called:', id);
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      const wasUnread = notification && !notification.read;

      const filtered = state.notifications.filter((n) => n.id !== id);
      console.log('[NotificationStore] Notification removed:', {
        id,
        found: !!notification,
        wasUnread,
        beforeCount: state.notifications.length,
        afterCount: filtered.length,
      });

      return {
        notifications: filtered,
        unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
      };
    });
  },
  
  removeNotificationByFriendshipId: (friendshipId: string) => {
    console.log('[NotificationStore] removeNotificationByFriendshipId called:', friendshipId);
    set((state) => {
      const notificationsToRemove = state.notifications.filter(
        (n) => n.friendshipId === friendshipId
      );
      const wasUnread = notificationsToRemove.some((n) => !n.read);

      const filtered = state.notifications.filter(
        (n) => n.friendshipId !== friendshipId
      );
      console.log('[NotificationStore] Notifications removed by friendshipId:', {
        friendshipId,
        removedCount: notificationsToRemove.length,
        wasUnread,
        beforeCount: state.notifications.length,
        afterCount: filtered.length,
      });

      return {
        notifications: filtered,
        unreadCount: wasUnread
          ? Math.max(0, state.unreadCount - notificationsToRemove.filter((n) => !n.read).length)
          : state.unreadCount,
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

