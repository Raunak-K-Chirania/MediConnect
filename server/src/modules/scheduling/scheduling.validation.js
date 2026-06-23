const { z } = require("zod");
const mongoose = require("mongoose");

// Helper to convert "HH:MM" format to minutes since midnight
const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

// Reusable ObjectId validation schema
const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: "Invalid MongoDB ObjectId format",
});

const timeFormatRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;

const timeStringSchema = z.string().regex(timeFormatRegex, {
  message: "Time must be in HH:MM 24-hour format",
});

// Break slot schema validation
const breakSlotSchema = z
  .object({
    start: timeStringSchema,
    end: timeStringSchema,
  })
  .refine(
    (data) => {
      return timeToMinutes(data.end) > timeToMinutes(data.start);
    },
    {
      message: "Break end time must be after start time",
      path: ["end"],
    }
  );

// Doctor availability creation schema
const createAvailabilitySchema = z
  .object({
    doctorId: objectIdSchema,
    workingDays: z
      .array(
        z.enum([
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ])
      )
      .min(1, "At least one working day must be specified"),
    startHour: timeStringSchema,
    endHour: timeStringSchema,
    slotDuration: z
      .number()
      .int()
      .positive("Slot duration must be a positive integer"),
    breakSlots: z.array(breakSlotSchema).optional().default([]),
  })
  .refine(
    (data) => {
      return timeToMinutes(data.endHour) > timeToMinutes(data.startHour);
    },
    {
      message: "Working endHour must be after startHour",
      path: ["endHour"],
    }
  )
  .refine(
    (data) => {
      const startMin = timeToMinutes(data.startHour);
      const endMin = timeToMinutes(data.endHour);
      for (const brk of data.breakSlots) {
        const brkStart = timeToMinutes(brk.start);
        const brkEnd = timeToMinutes(brk.end);
        if (brkStart < startMin || brkEnd > endMin) {
          return false;
        }
      }
      return true;
    },
    {
      message: "Break slots must fall within working hours",
      path: ["breakSlots"],
    }
  );

// Doctor availability update schema (partial of create schema)
const updateAvailabilitySchema = z
  .object({
    workingDays: z
      .array(
        z.enum([
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ])
      )
      .min(1)
      .optional(),
    startHour: timeStringSchema.optional(),
    endHour: timeStringSchema.optional(),
    slotDuration: z.number().int().positive().optional(),
    breakSlots: z.array(breakSlotSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.startHour && data.endHour) {
        return timeToMinutes(data.endHour) > timeToMinutes(data.startHour);
      }
      return true;
    },
    {
      message: "Working endHour must be after startHour",
      path: ["endHour"],
    }
  );

// Appointment creation schema
const createAppointmentSchema = z
  .object({
    patientId: objectIdSchema,
    doctorId: objectIdSchema,
    appointmentDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid date format for appointmentDate",
      })
      .transform((val) => new Date(val)),
    startTime: timeStringSchema,
    endTime: timeStringSchema,
    appointmentType: z.string().min(1, "Appointment type is required"),
    reasonForVisit: z.string().min(1, "Reason for visit is required"),
    notes: z.string().optional().default(""),
  })
  .refine(
    (data) => {
      return timeToMinutes(data.endTime) > timeToMinutes(data.startTime);
    },
    {
      message: "Appointment endTime must be after startTime",
      path: ["endTime"],
    }
  )
  .refine(
    (data) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const apptDate = new Date(data.appointmentDate);
      apptDate.setHours(0, 0, 0, 0);
      return apptDate >= today;
    },
    {
      message: "Appointment date cannot be in the past",
      path: ["appointmentDate"],
    }
  );

module.exports = {
  timeToMinutes,
  objectIdSchema,
  createAvailabilitySchema,
  updateAvailabilitySchema,
  createAppointmentSchema,
};
