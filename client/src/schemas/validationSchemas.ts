import { z } from 'zod';

const timeFormatRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;

const timeToMinutes = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

// 1. Appointment Booking Schema
export const appointmentBookingSchema = z
  .object({
    appointmentDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid date format',
    }),
    startTime: z.string().regex(timeFormatRegex, {
      message: 'Time must be in HH:MM 24-hour format',
    }),
    endTime: z.string().regex(timeFormatRegex, {
      message: 'Time must be in HH:MM 24-hour format',
    }),
    appointmentType: z.string().min(1, 'Appointment type is required'),
    reasonForVisit: z.string().min(1, 'Reason for visit is required'),
    notes: z.string().optional().default(''),
  })
  .refine((data) => timeToMinutes(data.endTime) > timeToMinutes(data.startTime), {
    message: 'End time must be after start time',
    path: ['endTime'],
  })
  .refine(
    (data) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const apptDate = new Date(data.appointmentDate);
      apptDate.setHours(0, 0, 0, 0);
      return apptDate >= today;
    },
    {
      message: 'Appointment date cannot be in the past',
      path: ['appointmentDate'],
    }
  );

// 2. Reschedule Appointment Schema
export const rescheduleAppointmentSchema = z
  .object({
    newDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid date format',
    }),
    newStartTime: z.string().regex(timeFormatRegex, {
      message: 'Time must be in HH:MM 24-hour format',
    }),
    newEndTime: z.string().regex(timeFormatRegex, {
      message: 'Time must be in HH:MM 24-hour format',
    }),
  })
  .refine((data) => timeToMinutes(data.newEndTime) > timeToMinutes(data.newStartTime), {
    message: 'Rescheduled end time must be after start time',
    path: ['newEndTime'],
  })
  .refine(
    (data) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const apptDate = new Date(data.newDate);
      apptDate.setHours(0, 0, 0, 0);
      return apptDate >= today;
    },
    {
      message: 'Rescheduled date cannot be in the past',
      path: ['newDate'],
    }
  );

// 3. Clinical Note Schema
export const clinicalNoteSchema = z.object({
  subjectiveFindings: z
    .string()
    .trim()
    .min(1, 'Subjective findings cannot be empty')
    .max(2000, 'Subjective findings must not exceed 2000 characters'),
  objectiveFindings: z
    .string()
    .trim()
    .min(1, 'Objective findings cannot be empty')
    .max(2000, 'Objective findings must not exceed 2000 characters'),
  assessment: z
    .string()
    .trim()
    .min(1, 'Assessment cannot be empty')
    .max(2000, 'Assessment must not exceed 2000 characters'),
  plan: z
    .string()
    .trim()
    .min(1, 'Plan cannot be empty')
    .max(2000, 'Plan must not exceed 2000 characters'),
  consultationDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format for consultationDate',
  }),
});

// 4. Availability Config Schema
export const availabilityConfigSchema = z
  .object({
    workingDays: z
      .array(
        z.enum([
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ])
      )
      .min(1, 'At least one working day must be selected'),
    startHour: z.string().regex(timeFormatRegex, {
      message: 'Start hour must be HH:MM',
    }),
    endHour: z.string().regex(timeFormatRegex, {
      message: 'End hour must be HH:MM',
    }),
    slotDuration: z
      .number()
      .int()
      .positive('Slot duration must be a positive integer'),
  })
  .refine((data) => timeToMinutes(data.endHour) > timeToMinutes(data.startHour), {
    message: 'End hour must be after start hour',
    path: ['endHour'],
  });

// 5. Medical Record Schema
export const medicalRecordSchema = z.object({
  diagnosis: z.string().min(1, 'Diagnosis is required'),
  symptoms: z.string().min(1, 'Symptoms are required'),
  treatmentPlan: z.string().min(1, 'Treatment plan is required'),
  medications: z.string().optional(),
  allergies: z.string().optional(), // Entered as comma-separated, can be parsed
  notes: z.string().optional(),
  visitDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid visit date',
  }),
  medicines: z
    .array(
      z.object({
        name: z.string().min(1, 'Medicine name is required'),
        dosage: z.string().min(1, 'Dosage is required'),
        frequency: z.string().min(1, 'Frequency is required'),
        duration: z.string().min(1, 'Duration is required'),
      })
    )
    .optional()
    .default([]),
  instructions: z.string().optional(),
});

export type AppointmentBookingInput = z.infer<typeof appointmentBookingSchema>;
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;
export type ClinicalNoteInput = z.infer<typeof clinicalNoteSchema>;
export type AvailabilityConfigInput = z.infer<typeof availabilityConfigSchema>;
export type MedicalRecordInput = z.infer<typeof medicalRecordSchema>;
