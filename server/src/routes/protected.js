const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const authorize = require("../middleware/role");
const User = require("../models/User");
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");
const AuditLog = require("../models/AuditLog");

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
      .limit(100);
    res.json({ logs });
  } catch (error) {
    console.error("Fetch audit logs error:", error);
    res.status(500).json({ error: "Server error fetching audit logs" });
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
