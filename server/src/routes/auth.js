const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const auth = require("../middleware/auth");
const { validateBody, registerSchema, loginSchema } = require("../middleware/validation");

// Helper function to generate JWT
const generateToken = (user) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL CONFIGURATION ERROR: JWT_SECRET environment variable is required in production.");
    }
  }
  return jwt.sign(
    { id: user._id, role: user.role },
    secret || "fallback_secret",
    { expiresIn: "1d" }
  );
};

// @route   POST /api/auth/register
// @desc    Register a new user (Patient, Doctor, or Admin)
// @access  Public
router.post("/register", validateBody(registerSchema), async (req, res) => {
  try {
    const { name, email, password, role, ...extraDetails } = req.body;

    // Normalize role (e.g., "patient" -> "Patient")
    let userRole = "Patient";
    if (role) {
      userRole = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
    }

    // Validate that normalized role is valid
    const validRoles = ["Patient", "Doctor", "Admin"];
    if (!validRoles.includes(userRole)) {
      return res.status(400).json({ error: `${role} is not a valid role. Allowed roles: Patient, Doctor, Admin.` });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ error: "User already exists with this email" });
    }

    // Validate role-specific requirements before creating the User
    if (userRole === "Doctor") {
      const { specialization, licenseNumber } = extraDetails;
      if (!specialization || !licenseNumber) {
        return res.status(400).json({ 
          error: "Doctor registration requires specialization and licenseNumber" 
        });
      }
      
      // Check if licenseNumber is unique
      const existingDoctor = await Doctor.findOne({ licenseNumber });
      if (existingDoctor) {
        return res.status(400).json({ error: "A doctor with this license number already exists" });
      }
    }

    // Create and save User
    user = new User({
      name,
      email,
      password,
      role: userRole,
    });

    await user.save();

    // Create role-specific profiles
    if (userRole === "Patient") {
      const patient = new Patient({
        user: user._id,
        gender: extraDetails.gender,
        dateOfBirth: extraDetails.dateOfBirth,
        bloodGroup: extraDetails.bloodGroup,
        phone: extraDetails.phone,
        address: extraDetails.address,
        emergencyContact: extraDetails.emergencyContact,
        allergies: extraDetails.allergies || [],
        medicalHistory: extraDetails.medicalHistory || [],
      });
      await patient.save();
    } else if (userRole === "Doctor") {
      const doctor = new Doctor({
        user: user._id,
        specialization: extraDetails.specialization,
        qualification: extraDetails.qualification,
        experience: extraDetails.experience,
        licenseNumber: extraDetails.licenseNumber,
        consultationFee: extraDetails.consultationFee,
        hospital: extraDetails.hospital,
        available: extraDetails.available !== undefined ? extraDetails.available : true,
      });
      await doctor.save();
    }

    // Generate token
    const token = generateToken(user);

    // Set audit user ID for logging middleware
    req.auditUserId = user._id;

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: error.message || "Server error during registration" });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post("/login", validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Generate token
    const token = generateToken(user);

    // Set audit user ID for logging middleware
    req.auditUserId = user._id;

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
});

// @route   GET /api/auth/me
// @desc    Get current logged in user details
// @access  Private
router.get("/me", auth, async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    console.error("Fetch me error:", error);
    res.status(500).json({ error: "Server error fetching user details" });
  }
});

// @route   GET /api/auth/doctors
// @desc    Get all doctors profiles populated with user details
// @access  Private
router.get("/doctors", auth, async (req, res) => {
  try {
    const doctors = await Doctor.find().populate("user", "name email role");
    res.json({ doctors });
  } catch (error) {
    console.error("Fetch doctors error:", error);
    res.status(500).json({ error: "Server error fetching doctors" });
  }
});

// @route   GET /api/auth/doctor-profile
// @desc    Get current doctor's profile & certificate details
// @access  Private (Doctor only)
router.get("/doctor-profile", auth, async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ user: req.user._id }).populate("user", "name email role");
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }
    res.json({ success: true, doctor });
  } catch (error) {
    console.error("Fetch doctor profile error:", error);
    res.status(500).json({ error: "Server error fetching doctor profile" });
  }
});

// @route   PUT /api/auth/doctor-profile
// @desc    Update doctor profile & medical practitioner certificate details
// @access  Private (Doctor only)
router.put("/doctor-profile", auth, async (req, res) => {
  try {
    let doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) {
      // If doctor profile doesn't exist yet, create one
      doctor = new Doctor({
        user: req.user._id,
        specialization: req.body.specialization || "General Practice",
        licenseNumber: req.body.licenseNumber || `LIC-${Date.now().toString().slice(-6)}`,
      });
    }

    const {
      specialization,
      qualification,
      experience,
      licenseNumber,
      consultationFee,
      hospital,
      certificateUrl,
      certificateNumber,
      certificateExpiryDate,
    } = req.body;

    if (specialization) doctor.specialization = specialization;
    if (qualification !== undefined) doctor.qualification = qualification;
    if (experience !== undefined) doctor.experience = Number(experience);
    if (licenseNumber) doctor.licenseNumber = licenseNumber;
    if (consultationFee !== undefined) doctor.consultationFee = Number(consultationFee);
    if (hospital !== undefined) doctor.hospital = hospital;

    // Practitioner Certificate updates
    if (certificateUrl !== undefined || certificateNumber !== undefined || certificateExpiryDate !== undefined) {
      if (certificateUrl !== undefined) doctor.certificateUrl = certificateUrl;
      if (certificateNumber !== undefined) doctor.certificateNumber = certificateNumber;
      if (certificateExpiryDate !== undefined) doctor.certificateExpiryDate = certificateExpiryDate ? new Date(certificateExpiryDate) : null;
      
      // Reset verification status to Pending whenever practitioner certificate details are updated
      doctor.verificationStatus = "Pending";
    }

    await doctor.save();
    const updatedDoctor = await Doctor.findById(doctor._id).populate("user", "name email role");

    res.json({
      success: true,
      message: "Medical practitioner certificate & profile updated. Pending admin verification.",
      doctor: updatedDoctor,
    });
  } catch (error) {
    console.error("Update doctor profile error:", error);
    res.status(500).json({ error: error.message || "Server error updating doctor profile" });
  }
});

module.exports = router;

