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
  rejectAppointmentSchema,
  cancelAppointmentSchema,
  rescheduleAppointmentSchema,
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
  authorize(["Doctor", "Admin", "Patient"]),
  controller.getAvailability
);

// Scheduling & Appointment APIs
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

router.patch(
  "/appointments/:id/approve",
  auth,
  authorize(["Doctor", "Admin"]),
  controller.approveAppointment
);

router.patch(
  "/appointments/:id/reject",
  auth,
  authorize(["Doctor", "Admin"]),
  validateBody(rejectAppointmentSchema),
  controller.rejectAppointment
);

router.patch(
  "/appointments/:id/cancel",
  auth,
  authorize(["Patient", "Doctor", "Admin"]),
  validateBody(cancelAppointmentSchema),
  controller.cancelAppointment
);

router.patch(
  "/appointments/:id/complete",
  auth,
  authorize(["Doctor", "Admin"]),
  controller.completeAppointment
);

router.patch(
  "/appointments/:id/reschedule",
  auth,
  authorize(["Patient", "Doctor", "Admin"]),
  validateBody(rescheduleAppointmentSchema),
  controller.rescheduleAppointment
);

router.get(
  "/appointments/upcoming",
  auth,
  authorize(["Patient", "Doctor", "Admin"]),
  controller.getUpcomingAppointments
);

router.get(
  "/appointments/patient/:patientId",
  auth,
  authorize(["Patient", "Admin"]),
  controller.getPatientAppointments
);

router.get(
  "/appointments/doctor/:doctorId",
  auth,
  authorize(["Doctor", "Admin"]),
  controller.getDoctorAppointments
);

router.get(
  "/appointments/:id",
  auth,
  authorize(["Patient", "Doctor", "Admin"]),
  controller.getAppointmentById
);

module.exports = router;
