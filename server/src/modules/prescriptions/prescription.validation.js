const { z } = require("zod");
const { objectIdSchema } = require("../../middleware/validation");

const createPrescriptionSchema = z.object({
  medicalRecord: objectIdSchema.optional(),
  patientId: objectIdSchema.optional(),
  medicines: z
    .array(
      z.object({
        name: z.string().min(1, "Medicine name is required"),
        dosage: z.string().min(1, "Medicine dosage is required"),
        frequency: z.string().optional().default(""),
        duration: z.string().optional().default(""),
      })
    )
    .min(1, "A prescription must contain at least one medicine"),
  instructions: z.string().optional().default(""),
  followUpDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid date format for followUpDate. Must be a valid date string.",
    })
    .transform((val) => new Date(val))
    .optional(),
}).refine(
  (data) => data.medicalRecord || data.patientId,
  {
    message: "Either medicalRecord or patientId must be provided",
    path: ["patientId"],
  }
);

module.exports = {
  createPrescriptionSchema,
};
