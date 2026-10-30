import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  detail?: string;
}

export interface Notification {
  id: string;
  tone: ToastTone;
  title: string;
  detail?: string;
  at: string;
  href?: string;
  read: boolean;
}

interface NotificationState {
  toasts: Toast[];
  notifications: Notification[];
  push: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
  notify: (n: Omit<Notification, 'id' | 'at' | 'read'>) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
}

const newId = () => Math.random().toString(36).slice(2, 10);

export const useNotificationStore = create<NotificationState>((set) => ({
  toasts: [],
  notifications: [],

  push(toast) {
    const id = newId();
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, toast.tone === 'error' ? 8000 : 4500);
  },

  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  notify(n) {
    set((s) => ({
      notifications: [
        { ...n, id: newId(), at: new Date().toISOString(), read: false },
        ...s.notifications,
      ].slice(0, 40),
    }));
  },

  markAllRead() {
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
  },

  clearNotifications() {
    set({ notifications: [] });
  },
}));

/** Convenience helpers for use outside React components. */
export const toast = {
  success: (title: string, detail?: string) =>
    useNotificationStore.getState().push({ tone: 'success', title, detail }),
  error: (title: string, detail?: string) =>
    useNotificationStore.getState().push({ tone: 'error', title, detail }),
  info: (title: string, detail?: string) =>
    useNotificationStore.getState().push({ tone: 'info', title, detail }),
  warning: (title: string, detail?: string) =>
    useNotificationStore.getState().push({ tone: 'warning', title, detail }),
};
