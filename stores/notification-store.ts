import { create } from 'zustand';
import { eventBus, emitAlertTriggered } from '@/lib/event-bus';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  timestamp: number;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  read: boolean;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  getNotificationsBySeverity: (severity: NotificationSeverity) => Notification[];
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (notification) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now(),
      read: false,
      duration: notification.duration ?? 5000,
    };

    set((state) => ({
      notifications: [newNotification, ...state.notifications].slice(0, 50), // Keep last 50
      unreadCount: state.unreadCount + 1,
    }));

    // Emit event for integration with event bus
    emitAlertTriggered(id, notification.severity, notification.message);

    // Auto-remove after duration if specified
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, newNotification.duration);
    }
  },

  removeNotification: (id) => {
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: notification && !notification.read 
          ? state.unreadCount - 1 
          : state.unreadCount,
      };
    });
  },

  markAsRead: (id) => {
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      if (!notification || notification.read) return state;

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

  clearAll: () => {
    set({
      notifications: [],
      unreadCount: 0,
    });
  },

  getNotificationsBySeverity: (severity) => {
    return get().notifications.filter((n) => n.severity === severity);
  },
}));

// Convenience functions for common notification types
export const notifyInfo = (title: string, message: string, duration?: number) => {
  useNotificationStore.getState().addNotification({
    title,
    message,
    severity: 'info',
    duration,
  });
};

export const notifySuccess = (title: string, message: string, duration?: number) => {
  useNotificationStore.getState().addNotification({
    title,
    message,
    severity: 'success',
    duration,
  });
};

export const notifyWarning = (title: string, message: string, duration?: number) => {
  useNotificationStore.getState().addNotification({
    title,
    message,
    severity: 'warning',
    duration,
  });
};

export const notifyError = (title: string, message: string, duration?: number) => {
  useNotificationStore.getState().addNotification({
    title,
    message,
    severity: 'error',
    duration,
  });
};
