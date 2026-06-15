const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const auth = require("../middleware/auth");

// Helper function to generate JWT
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || "fallback_secret",
    { expiresIn: "1d" }
  );
};

// @route   POST /api/auth/register
// @desc    Register a new user (Patient, Doctor, or Admin)
// @access  Public
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, ...extraDetails } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

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
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Please provide email and password" });
    }

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

module.exports = router;
