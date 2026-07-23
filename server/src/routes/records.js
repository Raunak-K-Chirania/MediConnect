const express = require("express");
const router = express.Router();
const MedicalRecord = require("../models/Medicalrecord");
const Prescription = require("../models/Prescription");
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");
const auth = require("../middleware/auth");
const authorize = require("../middleware/role");
const { validateBody, createMedicalRecordSchema, updateMedicalRecordSchema } = require("../middleware/validation");
const medicalRecordService = require("../services/medical-record.service");
const ApiError = require("../utils/ApiError");

// @route   POST /medical-records
// @desc    Create a medical record and optional prescription (encrypted)
// @access  Private (Doctor only)
router.post("/", auth, authorize("Doctor"), validateBody(createMedicalRecordSchema), async (req, res, next) => {
  try {
    const { patientId, diagnosis, symptoms, treatmentPlan, medications, allergies, notes, visitDate, prescription } = req.body;

    // Verify patient exists (by Patient ID or User ID)
    let patientExists = await Patient.findById(patientId);
    if (!patientExists) {
      patientExists = await Patient.findOne({ user: patientId });
    }
    if (!patientExists) {
      throw new ApiError(404, "Patient not found");
    }

    // Find Doctor profile linked to the logged in user
    const doctor = await Doctor.findOne({ user: req.user.id });
    if (!doctor) {
      throw new ApiError(403, "Doctor profile not found. Access denied.");
    }

    // Enforce role-based access / assignment: Doctors can access records only for patients assigned to them (via Appointment)
    const isAssigned = await Appointment.findOne({
      $or: [
        { patient: patientExists._id, doctor: doctor._id },
        { patientId: patientExists.user, doctorId: req.user.id },
        { patient: patientExists._id, doctorId: req.user.id },
        { patientId: patientExists.user, doctor: doctor._id }
      ]
    });
    if (!isAssigned) {
      throw new ApiError(403, "Forbidden: You cannot create a record for a patient who is not assigned to you.");
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

    // Set rich audit logging context for middleware
    req.auditLogData = {
      action: "MEDICAL_RECORD_CREATED",
      resourceType: "MedicalRecord",
      resourceId: medicalRecord._id,
    };

    res.status(201).json({
      success: true,
      message: "Medical record created successfully",
      data: { medicalRecord, prescription: savedPrescription },
      medicalRecord,
      prescription: savedPrescription,
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /medical-records/patient/:patientId
// @desc    Get all medical records for a specific patient
// @access  Private (Doctor, Admin, or Patient owner)
router.get("/patient/:patientId", auth, async (req, res, next) => {
  try {
    const { patientId } = req.params;

    // Resolve patientId: it could be a Patient profile ID or a User ID
    let actualPatientId = patientId;
    let patientProfile = await Patient.findById(patientId);
    if (!patientProfile) {
      // Try finding by User ID
      patientProfile = await Patient.findOne({ user: patientId });
      if (patientProfile) {
        actualPatientId = patientProfile._id;
      }
    }

    if (!patientProfile) {
      throw new ApiError(404, "Patient profile not found");
    }

    // Authorization & Access Control checks
    if (req.user.role === "Patient") {
      // Find patient profile for current user
      const currentUserPatientProfile = await Patient.findOne({ user: req.user.id });
      if (!currentUserPatientProfile || currentUserPatientProfile._id.toString() !== actualPatientId.toString()) {
        throw new ApiError(403, "Forbidden: You can only access your own medical records.");
      }
    } else if (req.user.role === "Doctor") {
      // Find Doctor profile linked to the logged in user
      const doctorProfile = await Doctor.findOne({ user: req.user.id });
      if (!doctorProfile) {
        throw new ApiError(403, "Doctor profile not found. Access denied.");
      }

      // Check if patient is assigned to this doctor
      const isAssigned = await Appointment.findOne({
        patient: actualPatientId,
        doctor: doctorProfile._id,
      });
      if (!isAssigned) {
        throw new ApiError(403, "Forbidden: You are not assigned to this patient.");
      }
    } else if (req.user.role !== "Admin") {
      throw new ApiError(403, "Forbidden: Access denied.");
    }

    // Find records, sort by visitDate descending, and populate doctor user info
    const records = await MedicalRecord.find({ patientId: actualPatientId, isDeleted: { $ne: true } })
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

    // Set rich audit logging context for middleware
    req.auditLogData = {
      action: "MEDICAL_RECORD_VIEWED",
      resourceType: "MedicalRecord",
    };

    res.json({
      success: true,
      message: "Medical records retrieved successfully",
      data: { records: recordsWithPrescriptions },
      records: recordsWithPrescriptions,
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /medical-records/:id
// @desc    Get specific medical record details with prescription
// @access  Private (Doctor, Admin, or Patient owner)
router.get("/:id", auth, async (req, res, next) => {
  try {
    const record = await MedicalRecord.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
      .populate({
        path: "patientId",
        populate: { path: "user", select: "name email" },
      })
      .populate({
        path: "doctorId",
        populate: { path: "user", select: "name" },
      });

    if (!record) {
      throw new ApiError(404, "Medical record not found");
    }

    // Authorization & Access Control checks
    if (req.user.role === "Patient") {
      const isOwner = record.patientId && record.patientId.user && record.patientId.user._id.toString() === req.user.id.toString();
      if (!isOwner) {
        throw new ApiError(403, "Forbidden: You can only access your own medical records.");
      }
    } else if (req.user.role === "Doctor") {
      // Find Doctor profile linked to the logged in user
      const doctorProfile = await Doctor.findOne({ user: req.user.id });
      if (!doctorProfile) {
        throw new ApiError(403, "Doctor profile not found. Access denied.");
      }

      // Check if patient of this medical record is assigned to this doctor
      const isAssigned = await Appointment.findOne({
        patient: record.patientId._id,
        doctor: doctorProfile._id,
      });
      if (!isAssigned) {
        throw new ApiError(403, "Forbidden: You are not assigned to this patient.");
      }
    } else if (req.user.role !== "Admin") {
      throw new ApiError(403, "Forbidden: Access denied.");
    }

    const prescription = await Prescription.findOne({ medicalRecord: record._id });

    // Set rich audit logging context for middleware
    req.auditLogData = {
      action: "MEDICAL_RECORD_VIEWED",
      resourceType: "MedicalRecord",
      resourceId: record._id,
    };

    res.json({
      success: true,
      message: "Medical record retrieved successfully",
      data: { record, prescription },
      record,
      prescription,
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /medical-records/:id
// @desc    Update a medical record
// @access  Private (Doctor or Admin)
router.put("/:id", auth, authorize(["Doctor", "Admin"]), validateBody(updateMedicalRecordSchema), async (req, res, next) => {
  try {
    const record = await medicalRecordService.updateMedicalRecord(req.params.id, req.body, req.user);

    req.auditLogData = {
      action: "MEDICAL_RECORD_UPDATED",
      resourceType: "MedicalRecord",
      resourceId: record._id,
    };

    res.json({
      success: true,
      message: "Medical record updated successfully",
      data: record,
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /medical-records/:id
// @desc    Soft delete a medical record
// @access  Private (Doctor or Admin)
router.delete("/:id", auth, authorize(["Doctor", "Admin"]), async (req, res, next) => {
  try {
    const record = await medicalRecordService.deleteMedicalRecord(req.params.id, req.user);

    req.auditLogData = {
      action: "MEDICAL_RECORD_DELETED",
      resourceType: "MedicalRecord",
      resourceId: record._id,
    };

    res.json({
      success: true,
      message: "Medical record deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});
module.exports = router;
