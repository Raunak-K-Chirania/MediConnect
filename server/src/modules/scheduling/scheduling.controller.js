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
      action: "APPOINTMENT_REQUESTED",
      resourceType: "Appointment",
      resourceId: appointment._id,
    };

    return successResponse(res, 201, "Appointment booked successfully", appointment);
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
};
