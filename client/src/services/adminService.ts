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

export const adminService = {
  async getStatistics(): Promise<PlatformStatistics> {
    const response = await axiosInstance.get<PlatformStatistics>('/protected/admin/statistics');
    return response.data;
  },

  async getAuditLogs(): Promise<{ success: boolean; logs: AuditLog[] }> {
    const response = await axiosInstance.get<{ success: boolean; logs: AuditLog[] }>('/protected/admin/audit-logs');
    return response.data;
  },
};
