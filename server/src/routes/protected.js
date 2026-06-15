const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const authorize = require("../middleware/role");

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

// Route accessible by both Doctors and Admins (Staff)
router.get("/staff", auth, authorize(["Doctor", "Admin"]), (req, res) => {
  res.json({
    message: `Welcome ${req.user.name} (${req.user.role}). You have successfully accessed the staff area.`,
    user: req.user,
  });
});

module.exports = router;
