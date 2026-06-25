import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, UserRole } from '../types/auth.types';

interface AuthState {
  user: User | null;
  token: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      role: null,
      isAuthenticated: false,
      login: (user, token) =>
        set({
          user,
          token,
          role: user.role,
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          user: null,
          token: null,
          role: null,
          isAuthenticated: false,
        }),
      setUser: (user) =>
        set({
          user,
          role: user.role,
          isAuthenticated: true,
        }),
    }),
    {
      name: 'mediconnect-auth',
    }
  )
);
