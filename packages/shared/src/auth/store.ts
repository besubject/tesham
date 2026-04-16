import { create } from 'zustand';
import { apiClient } from '../api/client';
import { tokenStorage } from '../storage/token';
import type { UserDto, UserLanguage } from '../types';

interface AuthState {
  user: UserDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  initialize: () => Promise<void>;
  setAuth: (user: UserDto, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (params: { name?: string; language?: UserLanguage }) => Promise<void>;
  deleteAccount: (code: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    try {
      const token = await tokenStorage.getAccessToken();
      if (!token) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }
      const { data } = await apiClient.get<UserDto>('/user/me');
      set({ user: data, isAuthenticated: true, isLoading: false });
    } catch {
      await tokenStorage.clearTokens();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  setAuth: async (user, accessToken, refreshToken) => {
    await tokenStorage.setAccessToken(accessToken);
    await tokenStorage.setRefreshToken(refreshToken);
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    await tokenStorage.clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  updateProfile: async (params) => {
    try {
      const { data } = await apiClient.patch<UserDto>('/user/me', params);
      set({ user: data });
    } catch {
      throw new Error('Failed to update profile');
    }
  },

  deleteAccount: async (code) => {
    await apiClient.delete('/user/me', { data: { code } });
    await tokenStorage.clearTokens();
    set({ user: null, isAuthenticated: false });
  },
}));
