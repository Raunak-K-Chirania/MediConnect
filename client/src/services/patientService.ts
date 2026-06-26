import axiosInstance from '../api/axios';
import { User } from '../types/auth.types';

export interface PatientProfile {
  _id: string;
  user: User;
  dateOfBirth?: string;
  gender?: 'Male' | 'Female' | 'Other';
  bloodGroup?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  phone?: string;
  address?: string;
  emergencyContact?: string;
  allergies?: string[];
  medicalHistory?: string[];
}

export const patientService = {
  async listAll(): Promise<{ success: boolean; patients: PatientProfile[] }> {
    const response = await axiosInstance.get<{ success: boolean; patients: PatientProfile[] }>('/patients');
    return response.data;
  },

  async getById(id: string): Promise<{ success: boolean; patient: PatientProfile }> {
    const response = await axiosInstance.get<{ success: boolean; patient: PatientProfile }>(`/patients/${id}`);
    return response.data;
  },

  async getMe(): Promise<{ success: boolean; patient: PatientProfile }> {
    const response = await axiosInstance.get<{ success: boolean; patient: PatientProfile }>('/patients/me');
    return response.data;
  },

  async updateMe(data: Partial<PatientProfile>): Promise<{ success: boolean; patient: PatientProfile }> {
    const response = await axiosInstance.put<{ success: boolean; patient: PatientProfile }>('/patients/me', data);
    return response.data;
  },
};
