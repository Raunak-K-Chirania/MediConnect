const express = require("express");
const router = express.Router();
const MedicalRecord = require("../models/Medicalrecord");
const Prescription = require("../models/Prescription");
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");
const auth = require("../middleware/auth");
const authorize = require("../middleware/role");
const { validateBody, createMedicalRecordSchema } = require("../middleware/validation");

// @route   POST /medical-records
// @desc    Create a medical record and optional prescription (encrypted)
// @access  Private (Doctor only)
router.post("/", auth, authorize("Doctor"), validateBody(createMedicalRecordSchema), async (req, res) => {
  try {
    const { patientId, diagnosis, symptoms, treatmentPlan, medications, allergies, notes, visitDate, prescription } = req.body;

    // Verify patient exists
    const patientExists = await Patient.findById(patientId);
    if (!patientExists) {
      return res.status(404).json({ error: "Patient not found" });
    }

    // Find Doctor profile linked to the logged in user
    const doctor = await Doctor.findOne({ user: req.user.id });
    if (!doctor) {
      return res.status(403).json({ error: "Doctor profile not found. Access denied." });
    }

    // Enforce role-based access / assignment: Doctors can access records only for patients assigned to them (via Appointment)
    const isAssigned = await Appointment.findOne({
      patient: patientId,
      doctor: doctor._id,
    });
    if (!isAssigned) {
      return res.status(403).json({
        error: "Forbidden: You cannot create a record for a patient who is not assigned to you.",
      });
    }

    // Create medical record
    const medicalRecord = new MedicalRecord({
      patientId,
      doctorId: doctor._id,
      diagnosis,
      symptoms,
      treatmentPlan,
      medications,
      allergies,
      notes,
      visitDate,
    });

    await medicalRecord.save();

    // If prescription is provided, create it (kept for backwards-compatibility)
    let savedPrescription = null;
    if (prescription && prescription.medicines && prescription.medicines.length > 0) {
      savedPrescription = new Prescription({
        medicalRecord: medicalRecord._id,
        medicines: prescription.medicines,
        instructions: prescription.instructions,
      });
      await savedPrescription.save();
    }

    res.status(201).json({
      message: "Medical record created successfully",
      medicalRecord,
      prescription: savedPrescription,
    });
  } catch (error) {
    console.error("Create medical record error:", error.message);
    res.status(500).json({ error: error.message || "Server error creating medical record" });
  }
});

// @route   GET /medical-records/patient/:patientId
// @desc    Get all medical records for a specific patient
// @access  Private (Doctor, Admin, or Patient owner)
router.get("/patient/:patientId", auth, async (req, res) => {
  try {
    const { patientId } = req.params;

    // Authorization & Access Control checks
    if (req.user.role === "Patient") {
      // Find patient profile for current user
      const patientProfile = await Patient.findOne({ user: req.user.id });
      if (!patientProfile || patientProfile._id.toString() !== patientId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own medical records." });
      }
    } else if (req.user.role === "Doctor") {
      // Find Doctor profile linked to the logged in user
      const doctorProfile = await Doctor.findOne({ user: req.user.id });
      if (!doctorProfile) {
        return res.status(403).json({ error: "Doctor profile not found. Access denied." });
      }

      // Check if patient is assigned to this doctor
      const isAssigned = await Appointment.findOne({
        patient: patientId,
        doctor: doctorProfile._id,
      });
      if (!isAssigned) {
        return res.status(403).json({ error: "Forbidden: You are not assigned to this patient." });
      }
    } else if (req.user.role !== "Admin") {
      return res.status(403).json({ error: "Forbidden: Access denied." });
    }

    // Find records, sort by visitDate descending, and populate doctor user info
    const records = await MedicalRecord.find({ patientId })
      .populate({
        path: "doctorId",
        populate: { path: "user", select: "name" },
      })
      .sort({ visitDate: -1 });

    // For each record, find prescription if any
    const recordsWithPrescriptions = await Promise.all(
      records.map(async (record) => {
        const recordObj = record.toObject();
        const prescription = await Prescription.findOne({ medicalRecord: record._id });
        recordObj.prescription = prescription;
        return recordObj;
      })
    );

    res.json({ records: recordsWithPrescriptions });
  } catch (error) {
    console.error("Fetch medical records error:", error.message);
    res.status(500).json({ error: "Server error fetching medical records" });
  }
});

// @route   GET /medical-records/:id
// @desc    Get specific medical record details with prescription
// @access  Private (Doctor, Admin, or Patient owner)
router.get("/:id", auth, async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id)
      .populate({
        path: "patientId",
        populate: { path: "user", select: "name email" },
      })
      .populate({
        path: "doctorId",
        populate: { path: "user", select: "name" },
      });

    if (!record) {
      return res.status(404).json({ error: "Medical record not found" });
    }

    // Authorization & Access Control checks
    if (req.user.role === "Patient") {
      const isOwner = record.patientId && record.patientId.user && record.patientId.user._id.toString() === req.user.id.toString();
      if (!isOwner) {
        return res.status(403).json({ error: "Forbidden: You can only access your own medical records." });
      }
    } else if (req.user.role === "Doctor") {
      // Find Doctor profile linked to the logged in user
      const doctorProfile = await Doctor.findOne({ user: req.user.id });
      if (!doctorProfile) {
        return res.status(403).json({ error: "Doctor profile not found. Access denied." });
      }

      // Check if patient of this medical record is assigned to this doctor
      const isAssigned = await Appointment.findOne({
        patient: record.patientId._id,
        doctor: doctorProfile._id,
      });
      if (!isAssigned) {
        return res.status(403).json({ error: "Forbidden: You are not assigned to this patient." });
      }
    } else if (req.user.role !== "Admin") {
      return res.status(403).json({ error: "Forbidden: Access denied." });
    }

    const prescription = await Prescription.findOne({ medicalRecord: record._id });

    res.json({
      record,
      prescription,
    });
  } catch (error) {
    console.error("Fetch record error:", error.message);
    res.status(500).json({ error: "Server error fetching record details" });
  }
});

module.exports = router;
