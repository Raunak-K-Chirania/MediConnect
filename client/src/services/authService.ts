import axiosInstance from '../api/axios';
import { AuthResponse, User } from '../types/auth.types';
import { LoginInput, RegisterInput } from '../schemas/authSchema';

export const authService = {
  async register(data: RegisterInput): Promise<AuthResponse> {
    // Exclude confirmPassword from payload before posting to backend
    const { confirmPassword, ...payload } = data;
    const response = await axiosInstance.post<AuthResponse>('/auth/register', payload);
    return response.data;
  },

  async login(data: LoginInput): Promise<AuthResponse> {
    const response = await axiosInstance.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  async getMe(): Promise<{ user: User }> {
    const response = await axiosInstance.get<{ user: User }>('/auth/me');
    return response.data;
  },
};
