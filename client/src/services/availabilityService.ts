import axiosInstance from '../api/axios';

export interface BreakSlot {
  start: string;
  end: string;
}

export interface DoctorAvailability {
  _id: string;
  doctorId: string;
  workingDays: string[];
  startHour: string;
  endHour: string;
  slotDuration: number;
  breakSlots: BreakSlot[];
}

export interface CreateAvailabilityInput {
  doctorId: string;
  workingDays: string[];
  startHour: string;
  endHour: string;
  slotDuration: number;
  breakSlots: BreakSlot[];
}

export const availabilityService = {
  async getByDoctor(doctorId: string): Promise<{ success: boolean; data: DoctorAvailability }> {
    const response = await axiosInstance.get<{ success: boolean; data: DoctorAvailability }>(`/doctor-availability/${doctorId}`);
    return response.data;
  },

  async create(data: CreateAvailabilityInput): Promise<{ success: boolean; data: DoctorAvailability }> {
    const response = await axiosInstance.post<{ success: boolean; data: DoctorAvailability }>('/doctor-availability', data);
    return response.data;
  },

  async update(id: string, data: Partial<CreateAvailabilityInput>): Promise<{ success: boolean; data: DoctorAvailability }> {
    const response = await axiosInstance.put<{ success: boolean; data: DoctorAvailability }>(`/doctor-availability/${id}`, data);
    return response.data;
  },
};
