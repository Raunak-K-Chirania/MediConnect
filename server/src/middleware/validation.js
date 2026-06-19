const { z } = require("zod");
const mongoose = require("mongoose");

// Reusable ObjectId validation schema
const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: "Invalid MongoDB ObjectId format",
});

// Zod validation schema for creating a medical record
const createMedicalRecordSchema = z.object({
  patientId: objectIdSchema,
  appointmentId: objectIdSchema.optional(),
  diagnosis: z
    .string()
    .min(1, "Diagnosis is required")
    .max(500, "Diagnosis must not exceed 500 characters"),
  symptoms: z.array(z.string().min(1, "Symptom cannot be empty")).optional().default([]),
  treatmentPlan: z
    .string()
    .min(1, "Treatment plan is required")
    .max(1000, "Treatment plan must not exceed 1000 characters"),
  medications: z.array(z.string().min(1, "Medication name cannot be empty")).optional().default([]),
  allergies: z.array(z.string().min(1, "Allergy cannot be empty")).optional().default([]),
  notes: z.string().max(2000, "Notes must not exceed 2000 characters").optional().default(""),
  visitDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid date format for visitDate. Must be a valid date string.",
    })
    .transform((val) => new Date(val)),
  prescription: z
    .object({
      medicines: z
        .array(
          z.object({
            name: z.string().min(1, "Medicine name is required"),
            dosage: z.string().min(1, "Medicine dosage is required"),
            frequency: z.string().min(1, "Medicine frequency is required"),
            duration: z.string().min(1, "Medicine duration is required"),
          })
        )
        .optional()
        .default([]),
      instructions: z.string().optional().default(""),
    })
    .optional(),
});

/**
 * Reusable Express middleware to validate request payloads against a Zod schema.
 * @param {z.ZodSchema} schema - The Zod schema to validate against req.body.
 */
const validateBody = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.errors || error.issues || [];
      return res.status(400).json({
        success: false,
        message: "Validation error: " + issues.map(err => `${err.path.join(".")}: ${err.message}`).join("; "),
        errors: issues.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      });
    }
    next(error);
  }
};

const updateMedicalRecordSchema = createMedicalRecordSchema.partial();

module.exports = {
  objectIdSchema,
  createMedicalRecordSchema,
  updateMedicalRecordSchema,
  validateBody,
};
