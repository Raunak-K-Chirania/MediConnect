import axiosInstance from '../api/axios';

export interface AuditLog {
  _id: string;
  timestamp: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  ipAddress: string;
  apiEndpoint: string;
  performedAction: string;
  action: string | null;
  role: string | null;
  resourceType: string | null;
  resourceId: string | null;
  method: string;
  statusCode: number;
}

export interface PlatformStatistics {
  totalPatients: number;
  totalDoctors: number;
  totalAppointments: number;
  activeUsers: number;
}

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: 'Patient' | 'Doctor' | 'Admin';
  createdAt: string;
  updatedAt: string;
  doctorProfile?: {
    _id: string;
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
    verificationStatus?: 'Pending' | 'Approved' | 'Rejected';
    verificationNotes?: string;
  } | null;
  patientProfile?: {
    _id: string;
    gender?: string;
    bloodGroup?: string;
    phone?: string;
  } | null;
}

export interface AdminAppointment {
  _id: string;
  patientId?: { _id: string; name: string; email: string };
  doctorId?: { _id: string; name: string; email: string };
  patient?: { _id: string };
  doctor?: { _id: string };
  appointmentDate: string;
  startTime: string;
  endTime: string;
  appointmentType: string;
  reasonForVisit?: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
  priority?: string;
  isEmergency?: boolean;
  createdAt: string;
}

export interface MedicineItem {
  name: string;
  dosage: string;
  frequency?: string;
  duration?: string;
}

export interface AdminPrescription {
  _id: string;
  patientId?: { _id: string; user?: { name: string; email: string } };
  doctorId?: { _id: string; user?: { name: string; email: string } };
  medicines: MedicineItem[];
  instructions?: string;
  followUpDate?: string;
  createdAt: string;
  hash?: string;
}

export interface SystemSettings {
  maintenanceMode: boolean;
  announcementText: string;
  announcementActive: boolean;
  requireDoctorVerification: boolean;
  maxBookingDaysInAdvance: number;
}

export const adminService = {
  async getStatistics(): Promise<PlatformStatistics> {
    const response = await axiosInstance.get<PlatformStatistics>('/protected/admin/statistics');
    return response.data;
  },

  async getAuditLogs(): Promise<{ success: boolean; logs: AuditLog[] }> {
    const response = await axiosInstance.get<{ success: boolean; logs: AuditLog[] }>('/protected/admin/audit-logs');
    return response.data;
  },

  async getUsers(): Promise<{ success: boolean; users: AdminUser[] }> {
    const response = await axiosInstance.get<{ success: boolean; users: AdminUser[] }>('/protected/admin/users');
    return response.data;
  },

  async updateUserRole(userId: string, role: 'Patient' | 'Doctor' | 'Admin'): Promise<{ success: boolean; message: string }> {
    const response = await axiosInstance.put<{ success: boolean; message: string }>(`/protected/admin/users/${userId}/role`, { role });
    return response.data;
  },

  async deleteUser(userId: string): Promise<{ success: boolean; message: string }> {
    const response = await axiosInstance.delete<{ success: boolean; message: string }>(`/protected/admin/users/${userId}`);
    return response.data;
  },

  async toggleDoctorAvailability(doctorId: string): Promise<{ success: boolean; available: boolean }> {
    const response = await axiosInstance.put<{ success: boolean; available: boolean }>(`/protected/admin/doctors/${doctorId}/toggle-availability`);
    return response.data;
  },

  async verifyDoctorCertificate(doctorId: string, status: 'Approved' | 'Rejected' | 'Pending', notes?: string): Promise<{ success: boolean; message: string }> {
    const response = await axiosInstance.put<{ success: boolean; message: string }>(`/protected/admin/doctors/${doctorId}/verify-certificate`, { status, notes });
    return response.data;
  },

  async getAppointments(): Promise<{ success: boolean; appointments: AdminAppointment[] }> {
    const response = await axiosInstance.get<{ success: boolean; appointments: AdminAppointment[] }>('/protected/admin/appointments');
    return response.data;
  },

  async updateAppointmentStatus(appointmentId: string, status: string): Promise<{ success: boolean; message: string }> {
    const response = await axiosInstance.patch<{ success: boolean; message: string }>(`/protected/admin/appointments/${appointmentId}/status`, { status });
    return response.data;
  },

  async getPrescriptions(): Promise<{ success: boolean; prescriptions: AdminPrescription[] }> {
    const response = await axiosInstance.get<{ success: boolean; prescriptions: AdminPrescription[] }>('/protected/admin/prescriptions');
    return response.data;
  },

  async getSettings(): Promise<{ success: boolean; settings: SystemSettings }> {
    const response = await axiosInstance.get<{ success: boolean; settings: SystemSettings }>('/protected/admin/settings');
    return response.data;
  },

  async updateSettings(settings: Partial<SystemSettings>): Promise<{ success: boolean; settings: SystemSettings }> {
    const response = await axiosInstance.put<{ success: boolean; settings: SystemSettings }>('/protected/admin/settings', settings);
    return response.data;
  },
};
