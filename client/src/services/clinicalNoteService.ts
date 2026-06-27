import axiosInstance from '../api/axios';

export interface ClinicalNote {
  _id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  subjectiveFindings: string;
  objectiveFindings: string;
  assessment: string;
  plan: string;
  attachments?: string[];
  consultationDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClinicalNoteInput {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  subjectiveFindings: string;
  objectiveFindings: string;
  assessment: string;
  plan: string;
  attachments?: string[];
  consultationDate: string;
}

export const clinicalNoteService = {
  async getByPatient(patientId: string): Promise<ClinicalNote[]> {
    const response = await axiosInstance.get<any>(`/clinical-notes/patient/${patientId}`);
    return response.data?.data?.notes || [];
  },

  async getById(id: string): Promise<ClinicalNote> {
    const response = await axiosInstance.get<any>(`/clinical-notes/${id}`);
    return response.data?.data || response.data;
  },

  async create(data: CreateClinicalNoteInput): Promise<ClinicalNote> {
    const response = await axiosInstance.post<any>('/clinical-notes', data);
    return response.data?.data || response.data;
  },

  async update(id: string, data: Partial<CreateClinicalNoteInput>): Promise<ClinicalNote> {
    const response = await axiosInstance.put<any>(`/clinical-notes/${id}`, data);
    return response.data?.data || response.data;
  },

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const response = await axiosInstance.delete<{ success: boolean; message: string }>(`/clinical-notes/${id}`);
    return response.data;
  },
};
