export type UserRole = 'Patient' | 'Doctor' | 'Admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  success?: boolean;
  message?: string;
  token: string;
  user: User;
}
