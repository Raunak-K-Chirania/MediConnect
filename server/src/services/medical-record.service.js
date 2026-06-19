const MedicalRecord = require("../models/Medicalrecord");
const Doctor = require("../models/Doctor");
const Appointment = require("../models/Appointment");

/**
 * Service to update an existing medical record.
 * Only allows updates to approved fields and verifies doctor/admin access.
 */
const updateMedicalRecord = async (recordId, updateData, user) => {
  const record = await MedicalRecord.findOne({ _id: recordId, isDeleted: { $ne: true } });
  if (!record) {
    const error = new Error("Medical record not found");
    error.statusCode = 404;
    throw error;
  }

  // Access Control check: only Admins and assigned/creator Doctors can update
  if (user.role === "Doctor") {
    const doctorProfile = await Doctor.findOne({ user: user._id });
    if (!doctorProfile) {
      const error = new Error("Doctor profile not found. Access denied.");
      error.statusCode = 403;
      throw error;
    }

    const isCreator = record.doctorId.toString() === doctorProfile._id.toString();
    let isAssigned = false;
    if (!isCreator) {
      isAssigned = await Appointment.findOne({
        patient: record.patientId,
        doctor: doctorProfile._id,
      });
    }

    if (!isCreator && !isAssigned) {
      const error = new Error("Forbidden: You are not authorized to update this medical record.");
      error.statusCode = 403;
      throw error;
    }
  } else if (user.role !== "Admin") {
    const error = new Error("Forbidden: Access denied.");
    error.statusCode = 403;
    throw error;
  }

  // Restrict to approved fields (do not allow modification of patientId, doctorId, isDeleted, deletedAt, etc.)
  const approvedFields = ["diagnosis", "symptoms", "treatmentPlan", "medications", "allergies", "notes"];
  approvedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      record[field] = updateData[field];
    }
  });

  await record.save();
  return record;
};

/**
 * Service to soft-delete an existing medical record.
 * Sets isDeleted = true and records deletion timestamp.
 */
const deleteMedicalRecord = async (recordId, user) => {
  const record = await MedicalRecord.findOne({ _id: recordId, isDeleted: { $ne: true } });
  if (!record) {
    const error = new Error("Medical record not found");
    error.statusCode = 404;
    throw error;
  }

  // Access Control check: only Admins and assigned/creator Doctors can delete
  if (user.role === "Doctor") {
    const doctorProfile = await Doctor.findOne({ user: user._id });
    if (!doctorProfile) {
      const error = new Error("Doctor profile not found. Access denied.");
      error.statusCode = 403;
      throw error;
    }

    const isCreator = record.doctorId.toString() === doctorProfile._id.toString();
    let isAssigned = false;
    if (!isCreator) {
      isAssigned = await Appointment.findOne({
        patient: record.patientId,
        doctor: doctorProfile._id,
      });
    }

    if (!isCreator && !isAssigned) {
      const error = new Error("Forbidden: You are not authorized to delete this medical record.");
      error.statusCode = 403;
      throw error;
    }
  } else if (user.role !== "Admin") {
    const error = new Error("Forbidden: Access denied.");
    error.statusCode = 403;
    throw error;
  }

  record.isDeleted = true;
  record.deletedAt = new Date();
  await record.save();
  return record;
};

module.exports = {
  updateMedicalRecord,
  deleteMedicalRecord,
};
