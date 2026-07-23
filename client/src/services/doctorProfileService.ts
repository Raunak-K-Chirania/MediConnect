import axiosInstance from '../api/axios';

export interface DoctorProfile {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  specialization: string;
  qualification?: string;
  experience?: number;
  licenseNumber: string;
  consultationFee?: number;
  hospital?: string;
  available: boolean;
  certificateUrl?: string;
  certificateNumber?: string;
  certificateExpiryDate?: string;
  verificationStatus: 'Pending' | 'Approved' | 'Rejected';
  verificationNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateDoctorProfilePayload {
  specialization?: string;
  qualification?: string;
  experience?: number;
  licenseNumber?: string;
  consultationFee?: number;
  hospital?: string;
  certificateUrl?: string;
  certificateNumber?: string;
  certificateExpiryDate?: string;
}

export const doctorProfileService = {
  async getProfile(): Promise<{ success: boolean; doctor: DoctorProfile }> {
    const response = await axiosInstance.get<{ success: boolean; doctor: DoctorProfile }>('/auth/doctor-profile');
    return response.data;
  },

  async updateProfile(payload: UpdateDoctorProfilePayload): Promise<{ success: boolean; message: string; doctor: DoctorProfile }> {
    const response = await axiosInstance.put<{ success: boolean; message: string; doctor: DoctorProfile }>('/auth/doctor-profile', payload);
    return response.data;
  },
};
