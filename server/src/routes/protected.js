const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const authorize = require("../middleware/role");
const User = require("../models/User");
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");
const Prescription = require("../models/Prescription");
const AuditLog = require("../models/AuditLog");

// In-memory system settings default configuration
let systemSettings = {
  maintenanceMode: false,
  announcementText: "Welcome to MediConnect Healthcare Portal. System operating normally.",
  announcementActive: true,
  requireDoctorVerification: false,
  maxBookingDaysInAdvance: 30,
};

// Public/Authenticated route to fetch system settings (e.g., for banner or maintenance check)
router.get("/system-settings", async (req, res) => {
  res.json({ success: true, settings: systemSettings });
});

// Route accessible by Patients only
router.get("/patient", auth, authorize("Patient"), (req, res) => {
  res.json({
    message: `Welcome Patient ${req.user.name}. You have successfully accessed the patient-only area.`,
    user: req.user,
  });
});

// Route accessible by Doctors only
router.get("/doctor", auth, authorize("Doctor"), (req, res) => {
  res.json({
    message: `Welcome Doctor ${req.user.name}. You have successfully accessed the doctor-only area.`,
    user: req.user,
  });
});

// Route accessible by Admins only
router.get("/admin", auth, authorize("Admin"), (req, res) => {
  res.json({
    message: `Welcome Admin ${req.user.name}. You have successfully accessed the admin-only area.`,
    user: req.user,
  });
});

// Route accessible by Admins only - Statistics
router.get("/admin/statistics", auth, authorize("Admin"), async (req, res) => {
  try {
    const totalPatients = await Patient.countDocuments();
    const totalDoctors = await Doctor.countDocuments();
    const totalAppointments = await Appointment.countDocuments();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeUsersCount = await User.countDocuments();
    const activeUsersList = await AuditLog.distinct("userId", { timestamp: { $gte: oneDayAgo } });
    const activeUsers = activeUsersList.filter(Boolean).length || activeUsersCount;

    res.json({
      totalPatients,
      totalDoctors,
      totalAppointments,
      activeUsers,
    });
  } catch (error) {
    console.error("Fetch statistics error:", error);
    res.status(500).json({ error: "Server error fetching statistics" });
  }
});

// Route accessible by Admins only - Audit Logs
router.get("/admin/audit-logs", auth, authorize("Admin"), async (req, res) => {
  try {
    const logs = await AuditLog.find()
      .populate("userId", "name email role")
      .sort({ timestamp: -1 })
      .limit(200);
    res.json({ logs });
  } catch (error) {
    console.error("Fetch audit logs error:", error);
    res.status(500).json({ error: "Server error fetching audit logs" });
  }
});

// --- ADMIN USER MANAGEMENT ---

// Get all users with Doctor & Patient profile information
router.get("/admin/users", auth, authorize("Admin"), async (req, res) => {
  try {
    const users = await User.find().select("-password").lean();
    
    // Attach doctor and patient profiles
    const userIds = users.map((u) => u._id);
    const doctors = await Doctor.find({ user: { $in: userIds } }).lean();
    const patients = await Patient.find({ user: { $in: userIds } }).lean();

    const doctorMap = {};
    doctors.forEach((d) => { doctorMap[d.user.toString()] = d; });
    const patientMap = {};
    patients.forEach((p) => { patientMap[p.user.toString()] = p; });

    const enrichedUsers = users.map((u) => ({
      ...u,
      doctorProfile: doctorMap[u._id.toString()] || null,
      patientProfile: patientMap[u._id.toString()] || null,
    }));

    res.json({ success: true, users: enrichedUsers });
  } catch (error) {
    console.error("Fetch admin users error:", error);
    res.status(500).json({ error: "Server error fetching users" });
  }
});

// Update user role
router.put("/admin/users/:id/role", auth, authorize("Admin"), async (req, res) => {
  try {
    const { role } = req.body;
    if (!["Patient", "Doctor", "Admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role specified" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.role = role;
    await user.save();

    // If upgraded to Doctor and Doctor record doesn't exist, create a default profile
    if (role === "Doctor") {
      let doctor = await Doctor.findOne({ user: user._id });
      if (!doctor) {
        doctor = new Doctor({
          user: user._id,
          specialization: "General Practice",
          licenseNumber: `LIC-ADMIN-ASSIGNED-${Date.now().toString().slice(-6)}`,
          available: true,
        });
        await doctor.save();
      }
    }

    res.json({ success: true, message: `User role updated to ${role}`, user });
  } catch (error) {
    console.error("Update user role error:", error);
    res.status(500).json({ error: error.message || "Server error updating user role" });
  }
});

// Delete user account
router.delete("/admin/users/:id", auth, authorize("Admin"), async (req, res) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ error: "Cannot delete your own admin account while logged in" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await Doctor.deleteOne({ user: user._id });
    await Patient.deleteOne({ user: user._id });
    await User.deleteOne({ _id: user._id });

    res.json({ success: true, message: "User account and associated profiles removed" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Server error deleting user" });
  }
});

// Toggle Doctor availability/verification state
router.put("/admin/doctors/:id/toggle-availability", auth, authorize("Admin"), async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }

    doctor.available = !doctor.available;
    await doctor.save();

    res.json({ success: true, available: doctor.available, doctor });
  } catch (error) {
    console.error("Toggle doctor availability error:", error);
    res.status(500).json({ error: "Server error toggling doctor status" });
  }
});

// Admin verification of Doctor Medical Practitioner Certificate
router.put("/admin/doctors/:id/verify-certificate", auth, authorize("Admin"), async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!["Approved", "Rejected", "Pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid verification status specified" });
    }

    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }

    doctor.verificationStatus = status;
    if (notes !== undefined) doctor.verificationNotes = notes;
    await doctor.save();

    res.json({
      success: true,
      message: `Doctor practitioner certificate marked as ${status}`,
      doctor,
    });
  } catch (error) {
    console.error("Verify doctor certificate error:", error);
    res.status(500).json({ error: "Server error verifying doctor certificate" });
  }
});


// --- ADMIN APPOINTMENTS CONTROL ---

router.get("/admin/appointments", auth, authorize("Admin"), async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate("patientId", "name email")
      .populate("doctorId", "name email")
      .populate("patient")
      .populate("doctor")
      .sort({ appointmentDate: -1, createdAt: -1 })
      .limit(100);

    res.json({ success: true, appointments });
  } catch (error) {
    console.error("Fetch admin appointments error:", error);
    res.status(500).json({ error: "Server error fetching appointments" });
  }
});

router.patch("/admin/appointments/:id/status", auth, authorize("Admin"), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["pending", "approved", "rejected", "cancelled", "completed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    appointment.status = status;
    await appointment.save();

    res.json({ success: true, message: `Appointment status updated to ${status}`, appointment });
  } catch (error) {
    console.error("Update appointment status error:", error);
    res.status(500).json({ error: "Server error updating appointment" });
  }
});

// --- ADMIN PRESCRIPTIONS OVERSIGHT ---

router.get("/admin/prescriptions", auth, authorize("Admin"), async (req, res) => {
  try {
    const prescriptions = await Prescription.find()
      .populate({
        path: "patientId",
        populate: { path: "user", select: "name email" }
      })
      .populate({
        path: "doctorId",
        populate: { path: "user", select: "name email" }
      })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, prescriptions });
  } catch (error) {
    console.error("Fetch admin prescriptions error:", error);
    res.status(500).json({ error: "Server error fetching prescriptions" });
  }
});

// --- ADMIN SYSTEM SETTINGS ---

router.get("/admin/settings", auth, authorize("Admin"), (req, res) => {
  res.json({ success: true, settings: systemSettings });
});

router.put("/admin/settings", auth, authorize("Admin"), (req, res) => {
  try {
    const { maintenanceMode, announcementText, announcementActive, requireDoctorVerification, maxBookingDaysInAdvance } = req.body;
    
    if (typeof maintenanceMode === "boolean") systemSettings.maintenanceMode = maintenanceMode;
    if (typeof announcementText === "string") systemSettings.announcementText = announcementText;
    if (typeof announcementActive === "boolean") systemSettings.announcementActive = announcementActive;
    if (typeof requireDoctorVerification === "boolean") systemSettings.requireDoctorVerification = requireDoctorVerification;
    if (typeof maxBookingDaysInAdvance === "number") systemSettings.maxBookingDaysInAdvance = maxBookingDaysInAdvance;

    res.json({ success: true, message: "System settings updated successfully", settings: systemSettings });
  } catch (error) {
    console.error("Update system settings error:", error);
    res.status(500).json({ error: "Server error updating settings" });
  }
});

// Route accessible by both Doctors and Admins (Staff)
router.get("/staff", auth, authorize(["Doctor", "Admin"]), (req, res) => {
  res.json({
    message: `Welcome ${req.user.name} (${req.user.role}). You have successfully accessed the staff area.`,
    user: req.user,
  });
});

module.exports = router;

