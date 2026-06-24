const DoctorAvailability = require("../../models/DoctorAvailability");
const Appointment = require("../../models/Appointment");
const User = require("../../models/User");
const Doctor = require("../../models/Doctor");
const schedulingService = require("./scheduling.service");
const ApiError = require("../../utils/ApiError");
const { successResponse } = require("../../utils/apiResponse");

// Create Doctor Availability
const createAvailability = async (req, res, next) => {
  try {
    const { doctorId } = req.body;

    // RBAC check: Doctors can only configure availability for themselves. Admins can configure for anyone.
    if (req.user.role === "Doctor" && req.user.id.toString() !== doctorId.toString()) {
      throw new ApiError(403, "Forbidden: Doctors can only configure their own availability.");
    }

    // Verify doctor user exists
    const doctorUser = await User.findById(doctorId);
    if (!doctorUser || doctorUser.role !== "Doctor") {
      throw new ApiError(400, "Invalid doctorId. User must have the role Doctor.");
    }

    // Check if availability config already exists
    const existing = await DoctorAvailability.findOne({ doctorId });
    if (existing) {
      throw new ApiError(400, "Availability configuration already exists for this doctor. Use PUT to update.");
    }

    const availability = new DoctorAvailability(req.body);
    await availability.save();

    // Audit Log context
    req.auditLogData = {
      action: "AVAILABILITY_CREATED",
      resourceType: "DoctorAvailability",
      resourceId: availability._id,
    };

    return successResponse(res, 201, "Doctor availability created successfully", availability);
  } catch (error) {
    next(error);
  }
};

// Update Doctor Availability
const updateAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Search by document ID first, then fallback to doctorId
    let availability = await DoctorAvailability.findById(id);
    if (!availability) {
      availability = await DoctorAvailability.findOne({ doctorId: id });
    }

    if (!availability) {
      throw new ApiError(404, "Doctor availability configuration not found.");
    }

    // RBAC check: Doctor can only update their own. Admins can update any.
    if (req.user.role === "Doctor" && req.user.id.toString() !== availability.doctorId.toString()) {
      throw new ApiError(403, "Forbidden: Doctors can only update their own availability.");
    }

    // Update fields
    const fieldsToUpdate = ["workingDays", "startHour", "endHour", "slotDuration", "breakSlots"];
    fieldsToUpdate.forEach((field) => {
      if (req.body[field] !== undefined) {
        availability[field] = req.body[field];
      }
    });

    await availability.save();

    req.auditLogData = {
      action: "AVAILABILITY_UPDATED",
      resourceType: "DoctorAvailability",
      resourceId: availability._id,
    };

    return successResponse(res, 200, "Doctor availability updated successfully", availability);
  } catch (error) {
    next(error);
  }
};

// Get Doctor Availability
const getAvailability = async (req, res, next) => {
  try {
    const { doctorId } = req.params;

    // RBAC check: Doctors can only retrieve their own. Admins can retrieve any.
    if (req.user.role === "Doctor" && req.user.id.toString() !== doctorId.toString()) {
      throw new ApiError(403, "Forbidden: Doctors can only retrieve their own availability.");
    }

    const availability = await DoctorAvailability.findOne({ doctorId });
    if (!availability) {
      throw new ApiError(404, "Availability configuration not found for this doctor.");
    }

    return successResponse(res, 200, "Doctor availability retrieved successfully", availability);
  } catch (error) {
    next(error);
  }
};

// Get Available Slots
const getAvailableSlots = async (req, res, next) => {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    if (!date) {
      throw new ApiError(400, "Query parameter 'date' is required.");
    }

    const slots = await schedulingService.generateAvailableSlots(doctorId, date);

    // Audit Log context
    req.auditLogData = {
      action: "AVAILABILITY_CHECKED",
      resourceType: "DoctorAvailability",
    };

    return res.status(200).json({
      success: true,
      message: "Available slots retrieved successfully",
      availableSlots: slots,
    });
  } catch (error) {
    next(error);
  }
};

// Create Appointment
const createAppointment = async (req, res, next) => {
  try {
    const { patientId, doctorId, appointmentDate, startTime, endTime, appointmentType, reasonForVisit, notes } = req.body;

    // RBAC Check: Patients can only book appointments for themselves. Admins can book for anyone.
    if (req.user.role === "Patient" && req.user.id.toString() !== patientId.toString()) {
      throw new ApiError(403, "Forbidden: Patients can only request appointments for themselves.");
    }

    // Run scheduling engine validations and check for collisions
    try {
      await schedulingService.verifyAppointmentRequest({
        doctorId,
        appointmentDate,
        startTime,
        endTime,
      });
    } catch (engineError) {
      // Set audit log description depending on the validation error type
      if (engineError.message === "Appointment slot unavailable") {
        req.auditLogData = {
          action: "CONFLICT_DETECTED",
          resourceType: "Appointment",
        };
      } else {
        req.auditLogData = {
          action: "SCHEDULING_REJECTED",
          resourceType: "Appointment",
        };
      }
      throw engineError;
    }

    // Insert Appointment
    const appointment = new Appointment({
      patientId,
      doctorId,
      appointmentDate,
      startTime,
      endTime,
      appointmentType,
      reasonForVisit,
      notes,
      status: "pending",
    });

    await appointment.save();

    // Audit Log context
    req.auditLogData = {
      action: "APPOINTMENT_CREATED",
      resourceType: "Appointment",
      resourceId: appointment._id,
    };

    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      status: appointment.status,
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

// Approve Appointment
const approveAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);

    if (!appointment) {
      throw new ApiError(404, "Appointment not found");
    }

    // RBAC: Doctor must own it, Admin bypasses.
    if (req.user.role === "Doctor" && appointment.doctorId.toString() !== req.user.id.toString()) {
      throw new ApiError(403, "Access denied. This appointment belongs to another doctor.");
    }

    // Transition Rule: Pending -> Approved
    if (appointment.status !== "pending") {
      throw new ApiError(400, `Invalid transition: Cannot approve appointment with status '${appointment.status}'`);
    }

    appointment.status = "approved";
    await appointment.save();

    req.auditLogData = {
      action: "APPOINTMENT_APPROVED",
      resourceType: "Appointment",
      resourceId: appointment._id,
    };

    return successResponse(res, 200, "Appointment approved successfully", appointment);
  } catch (error) {
    next(error);
  }
};

// Reject Appointment
const rejectAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      throw new ApiError(400, "Rejection reason is required");
    }

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      throw new ApiError(404, "Appointment not found");
    }

    // RBAC: Doctor must own it, Admin bypasses.
    if (req.user.role === "Doctor" && appointment.doctorId.toString() !== req.user.id.toString()) {
      throw new ApiError(403, "Access denied. This appointment belongs to another doctor.");
    }

    // Transition Rule: Pending -> Rejected
    if (appointment.status !== "pending") {
      throw new ApiError(400, `Invalid transition: Cannot reject appointment with status '${appointment.status}'`);
    }

    appointment.status = "rejected";
    appointment.notes = reason;
    await appointment.save();

    req.auditLogData = {
      action: "APPOINTMENT_REJECTED",
      resourceType: "Appointment",
      resourceId: appointment._id,
    };

    return successResponse(res, 200, "Appointment rejected successfully", appointment);
  } catch (error) {
    next(error);
  }
};

// Cancel Appointment
const cancelAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      throw new ApiError(400, "Cancellation reason is required");
    }

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      throw new ApiError(404, "Appointment not found");
    }

    // RBAC: Patient (own), Doctor (own), Admin (all)
    if (req.user.role === "Patient" && appointment.patientId.toString() !== req.user.id.toString()) {
      throw new ApiError(403, "Access denied. You cannot cancel another patient's appointment.");
    }
    if (req.user.role === "Doctor" && appointment.doctorId.toString() !== req.user.id.toString()) {
      throw new ApiError(403, "Access denied. You cannot cancel another doctor's appointment.");
    }

    // Business Rules: Cannot cancel completed appointments.
    if (appointment.status === "completed") {
      throw new ApiError(400, "Cannot cancel completed appointments");
    }
    if (["cancelled", "rejected"].includes(appointment.status)) {
      throw new ApiError(400, `Appointment is already inactive (status: '${appointment.status}')`);
    }

    // Transition: approved -> cancelled, pending -> cancelled
    appointment.status = "cancelled";
    appointment.notes = reason;
    await appointment.save();

    req.auditLogData = {
      action: "APPOINTMENT_CANCELLED",
      resourceType: "Appointment",
      resourceId: appointment._id,
    };

    return successResponse(res, 200, "Appointment cancelled successfully", appointment);
  } catch (error) {
    next(error);
  }
};

// Complete Appointment
const completeAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);

    if (!appointment) {
      throw new ApiError(404, "Appointment not found");
    }

    // RBAC: Doctor must own it, Admin bypasses.
    if (req.user.role === "Doctor" && appointment.doctorId.toString() !== req.user.id.toString()) {
      throw new ApiError(403, "Access denied. This appointment belongs to another doctor.");
    }

    // Transition Rule: Approved -> Completed
    if (appointment.status !== "approved") {
      throw new ApiError(400, `Invalid transition: Cannot complete appointment with status '${appointment.status}' (must be approved first)`);
    }

    appointment.status = "completed";
    await appointment.save();

    req.auditLogData = {
      action: "APPOINTMENT_COMPLETED",
      resourceType: "Appointment",
      resourceId: appointment._id,
    };

    return successResponse(res, 200, "Appointment completed successfully", appointment);
  } catch (error) {
    next(error);
  }
};

// Reschedule Appointment
const rescheduleAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newDate, newStartTime, newEndTime } = req.body;

    const appointment = await Appointment.findById(id);
    if (!appointment) {
      throw new ApiError(404, "Appointment not found");
    }

    // RBAC:
    // Patient: can only reschedule pending own appointments
    if (req.user.role === "Patient") {
      if (appointment.patientId.toString() !== req.user.id.toString()) {
        throw new ApiError(403, "Access denied. You cannot reschedule another patient's appointment.");
      }
      if (appointment.status !== "pending") {
        throw new ApiError(400, "Patients can only reschedule pending appointments");
      }
    }
    // Doctor: must own it
    if (req.user.role === "Doctor" && appointment.doctorId.toString() !== req.user.id.toString()) {
      throw new ApiError(403, "Access denied. This appointment belongs to another doctor.");
    }
    // Admin can reschedule any

    // Run scheduling engine validations and check for collisions, excluding self
    try {
      await schedulingService.verifyAppointmentRequest({
        doctorId: appointment.doctorId,
        appointmentDate: newDate,
        startTime: newStartTime,
        endTime: newEndTime,
        excludeAppointmentId: appointment._id,
      });
    } catch (engineError) {
      if (engineError.message === "Appointment slot unavailable") {
        req.auditLogData = {
          action: "CONFLICT_DETECTED",
          resourceType: "Appointment",
        };
      } else {
        req.auditLogData = {
          action: "SCHEDULING_REJECTED",
          resourceType: "Appointment",
        };
      }
      throw engineError;
    }

    // Update appointment
    appointment.appointmentDate = newDate;
    appointment.startTime = newStartTime;
    appointment.endTime = newEndTime;
    await appointment.save();

    req.auditLogData = {
      action: "APPOINTMENT_RESCHEDULED",
      resourceType: "Appointment",
      resourceId: appointment._id,
    };

    return successResponse(res, 200, "Appointment rescheduled successfully", appointment);
  } catch (error) {
    next(error);
  }
};

// Get Appointment By ID
const getAppointmentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findById(id);

    if (!appointment) {
      throw new ApiError(404, "Appointment not found");
    }

    // RBAC: Patient (own), Doctor (own), Admin (any)
    if (req.user.role === "Patient" && appointment.patientId.toString() !== req.user.id.toString()) {
      throw new ApiError(403, "Access denied. You cannot access another patient's appointment details.");
    }
    if (req.user.role === "Doctor" && appointment.doctorId.toString() !== req.user.id.toString()) {
      throw new ApiError(403, "Access denied. You cannot access another doctor's appointment details.");
    }

    return successResponse(res, 200, "Appointment retrieved successfully", appointment);
  } catch (error) {
    next(error);
  }
};

// Get Patient Appointments
const getPatientAppointments = async (req, res, next) => {
  try {
    const { patientId } = req.params;

    // RBAC: Patient themselves or Admin
    if (req.user.role === "Patient" && req.user.id.toString() !== patientId.toString()) {
      throw new ApiError(403, "Access denied. You cannot view another patient's appointments.");
    }
    if (req.user.role === "Doctor") {
      throw new ApiError(403, "Access denied. Doctors cannot view patient appointment lists directly.");
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { patientId };
    if (req.query.status) {
      query.status = req.query.status;
    }

    const total = await Appointment.countDocuments(query);
    const appointments = await Appointment.find(query)
      .sort({ appointmentDate: -1, startTime: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      message: "Patient appointments retrieved successfully",
      data: appointments,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get Doctor Appointments
const getDoctorAppointments = async (req, res, next) => {
  try {
    const { doctorId } = req.params;

    // RBAC: Doctor themselves or Admin
    if (req.user.role === "Doctor" && req.user.id.toString() !== doctorId.toString()) {
      throw new ApiError(403, "Access denied. You cannot view another doctor's appointments.");
    }

    const query = { doctorId };
    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.schedule === "daily") {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      query.appointmentDate = { $gte: startOfDay, $lte: endOfDay };
    } else if (req.query.schedule === "weekly") {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfWeek = new Date();
      endOfWeek.setDate(startOfToday.getDate() + 7);
      endOfWeek.setHours(23, 59, 59, 999);
      query.appointmentDate = { $gte: startOfToday, $lte: endOfWeek };
    }

    const appointments = await Appointment.find(query).sort({ appointmentDate: 1, startTime: 1 });
    return successResponse(res, 200, "Doctor schedule retrieved successfully", appointments);
  } catch (error) {
    next(error);
  }
};

// Get Upcoming Appointments
const getUpcomingAppointments = async (req, res, next) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const query = {
      appointmentDate: { $gte: startOfToday },
    };

    // Filter by user context
    if (req.user.role === "Patient") {
      query.patientId = req.user.id;
    } else if (req.user.role === "Doctor") {
      query.doctorId = req.user.id;
    }
    // Admin has no user filter (returns all upcoming)

    if (req.query.status) {
      query.status = req.query.status;
    }

    const appointments = await Appointment.find(query).sort({ appointmentDate: 1, startTime: 1 });
    return successResponse(res, 200, "Upcoming appointments retrieved successfully", appointments);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAvailability,
  updateAvailability,
  getAvailability,
  getAvailableSlots,
  createAppointment,
  approveAppointment,
  rejectAppointment,
  cancelAppointment,
  completeAppointment,
  rescheduleAppointment,
  getAppointmentById,
  getPatientAppointments,
  getDoctorAppointments,
  getUpcomingAppointments,
};
