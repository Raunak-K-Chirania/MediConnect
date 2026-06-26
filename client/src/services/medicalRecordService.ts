import axiosInstance from '../api/axios';

export interface Prescription {
  _id?: string;
  medicalRecord?: string;
  medicines: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
  }>;
  instructions?: string;
}

export interface MedicalRecord {
  _id: string;
  patientId: any;
  doctorId: any;
  diagnosis: string;
  symptoms: string;
  treatmentPlan: string;
  medications?: string;
  allergies?: string[];
  notes?: string;
  visitDate: string;
  prescription?: Prescription;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMedicalRecordInput {
  patientId: string;
  diagnosis: string;
  symptoms: string;
  treatmentPlan: string;
  medications?: string;
  allergies?: string[];
  notes?: string;
  visitDate: string;
  prescription?: {
    medicines: Array<{
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
    }>;
    instructions?: string;
  };
}

export const medicalRecordService = {
  async getByPatient(patientId: string): Promise<{ success: boolean; data: { records: MedicalRecord[] } }> {
    const response = await axiosInstance.get<{ success: boolean; data: { records: MedicalRecord[] } }>(
      `/medical-records/patient/${patientId}`
    );
    return response.data;
  },

  async getById(id: string): Promise<{ success: boolean; data: { record: MedicalRecord; prescription?: Prescription } }> {
    const response = await axiosInstance.get<{ success: boolean; data: { record: MedicalRecord; prescription?: Prescription } }>(
      `/medical-records/${id}`
    );
    return response.data;
  },

  async create(data: CreateMedicalRecordInput): Promise<{ success: boolean; data: { medicalRecord: MedicalRecord; prescription?: Prescription } }> {
    const response = await axiosInstance.post<{ success: boolean; data: { medicalRecord: MedicalRecord; prescription?: Prescription } }>(
      '/medical-records',
      data
    );
    return response.data;
  },

  async update(id: string, data: Partial<CreateMedicalRecordInput>): Promise<{ success: boolean; data: MedicalRecord }> {
    const response = await axiosInstance.put<{ success: boolean; data: MedicalRecord }>(`/medical-records/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const response = await axiosInstance.delete<{ success: boolean; message: string }>(`/medical-records/${id}`);
    return response.data;
  },
};
