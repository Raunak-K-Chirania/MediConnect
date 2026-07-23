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
  symptoms: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return [];
      if (typeof val === 'string') return val.split(',').map((s) => s.trim()).filter(Boolean);
      return val;
    }),
  treatmentPlan: z
    .string()
    .min(1, "Treatment plan is required")
    .max(1000, "Treatment plan must not exceed 1000 characters"),
  medications: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return [];
      if (typeof val === 'string') return val.split(',').map((s) => s.trim()).filter(Boolean);
      return val;
    }),
  allergies: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (!val) return [];
      if (typeof val === 'string') return val.split(',').map((s) => s.trim()).filter(Boolean);
      return val;
    }),
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
    next(error);
  }
};

const updateMedicalRecordSchema = createMedicalRecordSchema.partial();

// Schema for user registration
const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long").max(100, "Name must not exceed 100 characters"),
  email: z.string().email("Please provide a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long").max(100, "Password must not exceed 100 characters"),
  role: z.enum(["Patient", "Doctor", "Admin", "patient", "doctor", "admin"]).optional(),
  
  // Doctor fields
  specialization: z.string().min(1, "Specialization is required for Doctor").optional(),
  licenseNumber: z.string().min(1, "License number is required for Doctor").optional(),
  qualification: z.string().optional(),
  experience: z.union([z.string(), z.number()]).optional(),
  consultationFee: z.union([z.string(), z.number()]).optional(),
  hospital: z.string().optional(),
  available: z.boolean().optional(),

  // Patient fields
  gender: z.enum(["Male", "Female", "Other", "male", "female", "other"]).optional(),
  dateOfBirth: z.string().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: "Invalid date format for dateOfBirth"
  }).optional(),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(),
  phone: z.string().regex(/^\+?[0-9\s\-]{7,15}$/, "Please provide a valid phone number (7-15 digits)").optional(),
  address: z.string().optional(),
  emergencyContact: z.string().regex(/^\+?[0-9\s\-]{7,15}$/, "Please provide a valid emergency contact phone number").optional(),
  allergies: z.array(z.string().min(1)).optional(),
  medicalHistory: z.array(z.string().min(1)).optional(),
}).refine(data => {
  const normalizedRole = data.role ? data.role.charAt(0).toUpperCase() + data.role.slice(1).toLowerCase() : "Patient";
  if (normalizedRole === "Doctor") {
    return !!data.specialization && !!data.licenseNumber;
  }
  return true;
}, {
  message: "Doctor registration requires specialization and licenseNumber",
  path: ["specialization"]
});

// Schema for user login
const loginSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
  password: z.string().min(1, "Password is required"),
});

// Schema for patient profile updates
const updatePatientSchema = z.object({
  gender: z.enum(["Male", "Female", "Other", "male", "female", "other"]).optional(),
  dateOfBirth: z.string().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: "Invalid date format for dateOfBirth"
  }).optional(),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]).optional(),
  phone: z.string().regex(/^\+?[0-9\s\-]{7,15}$/, "Please provide a valid phone number (7-15 digits)").optional(),
  address: z.string().optional(),
  emergencyContact: z.string().regex(/^\+?[0-9\s\-]{7,15}$/, "Please provide a valid emergency contact phone number").optional(),
  allergies: z.array(z.string().min(1)).optional(),
  medicalHistory: z.array(z.string().min(1)).optional(),
});

module.exports = {
  objectIdSchema,
  createMedicalRecordSchema,
  updateMedicalRecordSchema,
  registerSchema,
  loginSchema,
  updatePatientSchema,
  validateBody,
};
