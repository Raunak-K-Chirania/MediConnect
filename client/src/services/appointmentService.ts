import axiosInstance from '../api/axios';

export interface Appointment {
  _id: string;
  patientId: any; // Can be object or ID
  doctorId: any; // Can be object or ID
  appointmentDate: string;
  startTime: string;
  endTime: string;
  appointmentType: string;
  reasonForVisit: string;
  notes?: string;
  isEmergency?: boolean;
  priority?: 'standard' | 'urgent' | 'emergency';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
  rejectionReason?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookAppointmentInput {
  patientId: string;
  doctorId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  appointmentType: string;
  reasonForVisit: string;
  notes?: string;
  isEmergency?: boolean;
  priority?: 'standard' | 'urgent' | 'emergency';
}

export interface RescheduleAppointmentInput {
  newDate: string;
  newStartTime: string;
  newEndTime: string;
}

export const appointmentService = {
  async getUpcoming(): Promise<{ success: boolean; data: Appointment[] }> {
    const response = await axiosInstance.get<{ success: boolean; data: Appointment[] }>('/appointments/upcoming');
    return response.data;
  },

  async getByPatient(patientId: string): Promise<{ success: boolean; data: Appointment[] }> {
    const response = await axiosInstance.get<{ success: boolean; data: Appointment[] }>(`/appointments/patient/${patientId}`);
    return response.data;
  },

  async getByDoctor(doctorId: string): Promise<{ success: boolean; data: Appointment[] }> {
    const response = await axiosInstance.get<{ success: boolean; data: Appointment[] }>(`/appointments/doctor/${doctorId}`);
    return response.data;
  },

  async getAvailableSlots(doctorId: string, date: string): Promise<{ success: boolean; availableSlots: string[] }> {
    const response = await axiosInstance.get<{ success: boolean; availableSlots: string[] }>(
      `/appointments/available-slots/${doctorId}?date=${date}`
    );
    return response.data;
  },

  async book(data: BookAppointmentInput): Promise<{ success: boolean; data: Appointment }> {
    const response = await axiosInstance.post<{ success: boolean; data: Appointment }>('/appointments', data);
    return response.data;
  },

  async approve(id: string): Promise<{ success: boolean; data: Appointment }> {
    const response = await axiosInstance.patch<{ success: boolean; data: Appointment }>(`/appointments/${id}/approve`);
    return response.data;
  },

  async reject(id: string, reason: string): Promise<{ success: boolean; data: Appointment }> {
    const response = await axiosInstance.patch<{ success: boolean; data: Appointment }>(`/appointments/${id}/reject`, { reason });
    return response.data;
  },

  async cancel(id: string, reason: string): Promise<{ success: boolean; data: Appointment }> {
    const response = await axiosInstance.patch<{ success: boolean; data: Appointment }>(`/appointments/${id}/cancel`, { reason });
    return response.data;
  },

  async complete(id: string): Promise<{ success: boolean; data: Appointment }> {
    const response = await axiosInstance.patch<{ success: boolean; data: Appointment }>(`/appointments/${id}/complete`);
    return response.data;
  },

  async reschedule(id: string, data: RescheduleAppointmentInput): Promise<{ success: boolean; data: Appointment }> {
    const response = await axiosInstance.patch<{ success: boolean; data: Appointment }>(`/appointments/${id}/reschedule`, data);
    return response.data;
  },

  async getById(id: string): Promise<{ success: boolean; data: Appointment }> {
    const response = await axiosInstance.get<{ success: boolean; data: Appointment }>(`/appointments/${id}`);
    return response.data;
  },

  async getMeetingToken(id: string): Promise<{ success: boolean; data: { token: string; roomId: string } }> {
    const response = await axiosInstance.get<{ success: boolean; data: { token: string; roomId: string } }>(
      `/appointments/${id}/meeting-token`
    );
    return response.data;
  },
};
