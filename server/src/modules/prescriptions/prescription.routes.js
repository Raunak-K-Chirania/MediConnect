const express = require("express");
const router = express.Router();
const controller = require("./prescription.controller");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/role");
const { validateBody } = require("../../middleware/validation");
const { createPrescriptionSchema } = require("./prescription.validation");

// Create Digital Prescription (Doctor only)
router.post(
  "/",
  auth,
  authorize("Doctor"),
  validateBody(createPrescriptionSchema),
  controller.createPrescription
);

// Retrieve single prescription details (Doctor, Patient, Admin)
router.get(
  "/:id",
  auth,
  authorize(["Doctor", "Patient", "Admin"]),
  controller.getPrescription
);

// Retrieve all prescriptions for a specific patient (Doctor, Patient, Admin)
router.get(
  "/patient/:patientId",
  auth,
  authorize(["Doctor", "Patient", "Admin"]),
  controller.getPatientPrescriptions
);

// Download PDF of a prescription (Doctor, Patient, Admin)
router.get(
  "/:id/pdf",
  auth,
  authorize(["Doctor", "Patient", "Admin"]),
  controller.downloadPdf
);

module.exports = router;
