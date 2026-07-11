const express = require("express");
const router = express.Router();
const Patient = require("../models/Patient");
const auth = require("../middleware/auth");
const authorize = require("../middleware/role");
const { validateBody, updatePatientSchema } = require("../middleware/validation");

// @route   GET /api/patients/me
// @desc    Get current patient's profile (decrypted)
// @access  Private (Patient only)
router.get("/me", auth, authorize("Patient"), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user.id }).populate("user", "name email role");
    if (!patient) {
      return res.status(404).json({ error: "Patient profile not found" });
    }
    res.json({ patient });
  } catch (error) {
    console.error("Fetch profile error:", error.message);
    res.status(500).json({ error: "Server error fetching profile" });
  }
});

// @route   GET /api/patients/:id
// @desc    Get patient profile by ID (decrypted)
// @access  Private (Doctors, Admins, or Patient owner)
router.get("/:id", auth, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).populate("user", "name email role");
    if (!patient) {
      return res.status(404).json({ error: "Patient profile not found" });
    }

    // Authorization check: User must be Doctor/Admin or the Patient themselves
    const isOwner = patient.user && patient.user._id.toString() === req.user.id.toString();
    const isStaff = ["Doctor", "Admin"].includes(req.user.role);

    if (!isOwner && !isStaff) {
      return res.status(403).json({ error: "Forbidden: Access restricted to authorized personnel or profile owner." });
    }

    res.json({ patient });
  } catch (error) {
    console.error("Fetch patient error:", error.message);
    res.status(500).json({ error: "Server error fetching patient details" });
  }
});

// @route   PUT /api/patients/me
// @desc    Update current patient's profile
// @access  Private (Patient only)
router.put("/me", auth, authorize("Patient"), validateBody(updatePatientSchema), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user.id });
    if (!patient) {
      return res.status(404).json({ error: "Patient profile not found" });
    }

    const {
      dateOfBirth,
      gender,
      bloodGroup,
      phone,
      address,
      emergencyContact,
      allergies,
      medicalHistory,
    } = req.body;

    // Update fields (Mongoose save will trigger encryption pre-save)
    if (dateOfBirth !== undefined) patient.dateOfBirth = dateOfBirth;
    if (gender !== undefined) patient.gender = gender;
    if (bloodGroup !== undefined) patient.bloodGroup = bloodGroup;
    if (phone !== undefined) patient.phone = phone;
    if (address !== undefined) patient.address = address;
    if (emergencyContact !== undefined) patient.emergencyContact = emergencyContact;
    if (allergies !== undefined) patient.allergies = allergies;
    if (medicalHistory !== undefined) patient.medicalHistory = medicalHistory;

    await patient.save();

    res.json({
      message: "Patient profile updated successfully",
      patient,
    });
  } catch (error) {
    console.error("Update profile error:", error.message);
    res.status(500).json({ error: error.message || "Server error updating profile" });
  }
});

// @route   GET /api/patients
// @desc    Get all patient profiles populated with user details
// @access  Private (Doctor or Admin only)
router.get("/", auth, authorize(["Doctor", "Admin"]), async (req, res) => {
  try {
    const patients = await Patient.find().populate("user", "name email role");
    res.json({ patients });
  } catch (error) {
    console.error("Fetch patients error:", error);
    res.status(500).json({ error: "Server error fetching patients" });
  }
});

module.exports = router;
