import { create } from 'zustand';
import { api, errorMessage, setUnauthorizedHandler, tokenStore } from '@/lib/api';
import { disconnectSocket, reauthSocket } from '@/lib/socket';
import type { Permission, User } from '@/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  initialising: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  restore: () => Promise<void>;
  updateUser: (user: User) => void;
  can: (permission: Permission) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  initialising: true,
  error: null,

  async login(email, password) {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post<{ token: string; user: User }>('/auth/login', {
        email,
        password,
      });
      tokenStore.set(data.token);
      reauthSocket();
      set({ user: data.user, loading: false, error: null });
      return true;
    } catch (err) {
      set({ loading: false, error: errorMessage(err), user: null });
      return false;
    }
  },

  logout() {
    tokenStore.clear();
    disconnectSocket();
    set({ user: null, error: null });
  },

  async restore() {
    if (!tokenStore.get()) {
      set({ initialising: false });
      return;
    }
    try {
      const { data } = await api.get<{ user: User }>('/auth/me');
      set({ user: data.user, initialising: false });
      reauthSocket();
    } catch {
      tokenStore.clear();
      set({ user: null, initialising: false });
    }
  },

  updateUser(user) {
    set({ user });
  },

  can(permission) {
    return get().user?.permissions?.includes(permission) ?? false;
  },
}));

// A 401 from anywhere drops the session.
setUnauthorizedHandler(() => useAuthStore.getState().logout());
