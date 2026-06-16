const express = require("express");
const router = express.Router();
const MedicalRecord = require("../models/Medicalrecord");
const Prescription = require("../models/Prescription");
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const auth = require("../middleware/auth");
const authorize = require("../middleware/role");

// @route   POST /api/records
// @desc    Create a medical record and optional prescription (encrypted)
// @access  Private (Doctor only)
router.post("/", auth, authorize("Doctor"), async (req, res) => {
  try {
    const { patientId, appointmentId, diagnosis, symptoms, notes, prescription } = req.body;

    if (!patientId || !diagnosis) {
      return res.status(400).json({ error: "Patient ID and diagnosis are required" });
    }

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

    // Create medical record
    const medicalRecord = new MedicalRecord({
      patient: patientId,
      doctor: doctor._id,
      appointment: appointmentId,
      diagnosis,
      symptoms: symptoms || [],
      notes,
    });

    await medicalRecord.save();

    // If prescription is provided, create it
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

// @route   GET /api/records/patient/:patientId
// @desc    Get all medical records for a specific patient
// @access  Private (Doctor, Admin, or Patient owner)
router.get("/patient/:patientId", auth, async (req, res) => {
  try {
    const { patientId } = req.params;

    // Check authorization: Owner or staff (Doctor/Admin)
    if (req.user.role === "Patient") {
      // Find patient profile for current user
      const patient = await Patient.findOne({ user: req.user.id });
      if (!patient || patient._id.toString() !== patientId) {
        return res.status(403).json({ error: "Forbidden: You can only access your own medical records." });
      }
    } else if (!["Doctor", "Admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: Access denied." });
    }

    // Find records and populate doctor user info
    const records = await MedicalRecord.find({ patient: patientId })
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name" },
      })
      .sort({ createdAt: -1 });

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

// @route   GET /api/records/:id
// @desc    Get specific medical record details with prescription
// @access  Private (Doctor, Admin, or Patient owner)
router.get("/:id", auth, async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id)
      .populate({
        path: "patient",
        populate: { path: "user", select: "name email" },
      })
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name" },
      });

    if (!record) {
      return res.status(404).json({ error: "Medical record not found" });
    }

    // Authorization: Owner or staff
    const isOwner = record.patient && record.patient.user && record.patient.user._id.toString() === req.user.id.toString();
    const isStaff = ["Doctor", "Admin"].includes(req.user.role);

    if (!isOwner && !isStaff) {
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
