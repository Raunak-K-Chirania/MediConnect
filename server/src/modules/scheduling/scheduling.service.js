const User = require("../../models/User");
const Doctor = require("../../models/Doctor");
const Appointment = require("../../models/Appointment");
const DoctorAvailability = require("../../models/DoctorAvailability");
const ApiError = require("../../utils/ApiError");
const { timeToMinutes } = require("./scheduling.validation");

// Helper to convert minutes back to "HH:MM"
const minutesToTime = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/**
 * Validates an appointment request against doctor status, working hours, break slots, and existing appointments.
 * Throws ApiError if validation fails.
 */
const verifyAppointmentRequest = async ({
  doctorId,
  appointmentDate,
  startTime,
  endTime,
}) => {
  // 1. Verify Doctor exists
  const doctorUser = await User.findById(doctorId);
  if (!doctorUser || doctorUser.role !== "Doctor") {
    throw new ApiError(400, "Doctor user not found");
  }

  // 2. Verify Doctor profile is active
  const doctorProfile = await Doctor.findOne({ user: doctorId });
  if (!doctorProfile) {
    throw new ApiError(400, "Doctor profile not found");
  }

  if (doctorProfile.available === false) {
    throw new ApiError(400, "Doctor is currently inactive or unavailable");
  }

  // 3. Fetch DoctorAvailability
  const availability = await DoctorAvailability.findOne({ doctorId });
  if (!availability) {
    throw new ApiError(400, "Doctor availability has not been configured");
  }

  // 4. Verify doctor works on the selected day
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const apptDate = new Date(appointmentDate);
  const dayName = daysOfWeek[apptDate.getDay()];
  if (!availability.workingDays.includes(dayName)) {
    throw new ApiError(400, `Doctor does not work on ${dayName}`);
  }

  // 5. Verify requested slot falls within working hours
  const slotStart = timeToMinutes(startTime);
  const slotEnd = timeToMinutes(endTime);
  const workStart = timeToMinutes(availability.startHour);
  const workEnd = timeToMinutes(availability.endHour);

  if (slotStart < workStart || slotEnd > workEnd) {
    throw new ApiError(400, "Requested slot falls outside doctor working hours");
  }

  // 6. Verify requested slot does not overlap with break slots (including lunch break)
  for (const brk of availability.breakSlots) {
    const brkStart = timeToMinutes(brk.start);
    const brkEnd = timeToMinutes(brk.end);
    if (slotStart < brkEnd && slotEnd > brkStart) {
      throw new ApiError(400, "Requested slot overlaps with doctor break time");
    }
  }

  // 7. Collision Detection Algorithm
  const startOfDay = new Date(appointmentDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(appointmentDate);
  endOfDay.setHours(23, 59, 59, 999);

  const existingAppts = await Appointment.find({
    doctorId,
    appointmentDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ["pending", "approved", "completed", "Scheduled", "Completed"] },
  });

  for (const appt of existingAppts) {
    const existingStart = timeToMinutes(appt.startTime);
    const existingEnd = timeToMinutes(appt.endTime);
    if (slotStart < existingEnd && slotEnd > existingStart) {
      throw new ApiError(400, "Appointment slot unavailable");
    }
  }

  return { availability, doctorProfile };
};

/**
 * Automatically generates available slots for a doctor on a given date.
 */
const generateAvailableSlots = async (doctorId, dateStr) => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new ApiError(400, "Invalid date format");
  }

  // 1. Fetch DoctorAvailability
  const availability = await DoctorAvailability.findOne({ doctorId });
  if (!availability) {
    return [];
  }

  // 2. Check if doctor works on the selected day
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = daysOfWeek[date.getDay()];
  if (!availability.workingDays.includes(dayName)) {
    return [];
  }

  // 3. Fetch existing appointments
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const existingAppts = await Appointment.find({
    doctorId,
    appointmentDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ["pending", "approved", "completed", "Scheduled", "Completed"] },
  });

  // 4. Generate candidate slots based on working hours and duration
  const startMin = timeToMinutes(availability.startHour);
  const endMin = timeToMinutes(availability.endHour);
  const duration = availability.slotDuration;

  const availableSlots = [];

  for (let mins = startMin; mins + duration <= endMin; mins += duration) {
    const slotStart = mins;
    const slotEnd = mins + duration;

    // Check overlap with break slots
    let inBreak = false;
    for (const brk of availability.breakSlots) {
      const brkStart = timeToMinutes(brk.start);
      const brkEnd = timeToMinutes(brk.end);
      if (slotStart < brkEnd && slotEnd > brkStart) {
        inBreak = true;
        break;
      }
    }
    if (inBreak) continue;

    // Check overlap with booked appointments
    let isBooked = false;
    for (const appt of existingAppts) {
      const apptStart = timeToMinutes(appt.startTime);
      const apptEnd = timeToMinutes(appt.endTime);
      if (slotStart < apptEnd && slotEnd > apptStart) {
        isBooked = true;
        break;
      }
    }
    if (isBooked) continue;

    // Add to results
    availableSlots.push(minutesToTime(slotStart));
  }

  return availableSlots;
};

module.exports = {
  verifyAppointmentRequest,
  generateAvailableSlots,
  minutesToTime,
};
