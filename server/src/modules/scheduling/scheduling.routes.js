const express = require("express");
const router = express.Router();
const controller = require("./scheduling.controller");
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/role");
const { validateBody } = require("../../middleware/validation");
const {
  createAvailabilitySchema,
  updateAvailabilitySchema,
  createAppointmentSchema,
} = require("./scheduling.validation");

// Doctor Availability APIs
router.post(
  "/doctor-availability",
  auth,
  authorize(["Doctor", "Admin"]),
  validateBody(createAvailabilitySchema),
  controller.createAvailability
);

router.put(
  "/doctor-availability/:id",
  auth,
  authorize(["Doctor", "Admin"]),
  validateBody(updateAvailabilitySchema),
  controller.updateAvailability
);

router.get(
  "/doctor-availability/:doctorId",
  auth,
  authorize(["Doctor", "Admin"]),
  controller.getAvailability
);

// Scheduling APIs
router.get(
  "/appointments/available-slots/:doctorId",
  auth,
  controller.getAvailableSlots
);

router.post(
  "/appointments",
  auth,
  authorize(["Patient", "Admin"]),
  validateBody(createAppointmentSchema),
  controller.createAppointment
);

module.exports = router;
