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

const normalizeRole = (role?: string): UserRole => {
  if (!role) return 'Patient';
  const lower = role.toLowerCase();
  if (lower === 'doctor') return 'Doctor';
  if (lower === 'admin') return 'Admin';
  return 'Patient';
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      role: null,
      isAuthenticated: false,
      login: (user, token) => {
        const normalizedRole = normalizeRole(user.role);
        set({
          user: { ...user, role: normalizedRole },
          token,
          role: normalizedRole,
          isAuthenticated: true,
        });
      },
      logout: () =>
        set({
          user: null,
          token: null,
          role: null,
          isAuthenticated: false,
        }),
      setUser: (user) => {
        const normalizedRole = normalizeRole(user.role);
        set({
          user: { ...user, role: normalizedRole },
          role: normalizedRole,
          isAuthenticated: true,
        });
      },
    }),
    {
      name: 'mediconnect-auth',
    }
  )
);
