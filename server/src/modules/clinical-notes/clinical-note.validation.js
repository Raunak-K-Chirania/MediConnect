const { z } = require("zod");
const { objectIdSchema } = require("../../middleware/validation");

const createClinicalNoteSchema = z.object({
  appointmentId: objectIdSchema,
  patientId: objectIdSchema,
  doctorId: objectIdSchema,
  subjectiveFindings: z
    .string()
    .trim()
    .min(1, "Subjective findings cannot be empty")
    .max(2000, "Subjective findings must not exceed 2000 characters"),
  objectiveFindings: z
    .string()
    .trim()
    .min(1, "Objective findings cannot be empty")
    .max(2000, "Objective findings must not exceed 2000 characters"),
  assessment: z
    .string()
    .trim()
    .min(1, "Assessment cannot be empty")
    .max(2000, "Assessment must not exceed 2000 characters"),
  plan: z
    .string()
    .trim()
    .min(1, "Plan cannot be empty")
    .max(2000, "Plan must not exceed 2000 characters"),
  attachments: z
    .array(z.string().trim().min(1, "Attachment path/URL cannot be empty"))
    .optional()
    .default([]),
  consultationDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid date format for consultationDate. Must be a valid date string.",
    })
    .transform((val) => new Date(val)),
});

const updateClinicalNoteSchema = createClinicalNoteSchema.partial();

module.exports = {
  createClinicalNoteSchema,
  updateClinicalNoteSchema,
};
