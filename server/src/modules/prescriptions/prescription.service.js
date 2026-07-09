const Prescription = require("../../models/Prescription");
const Doctor = require("../../models/Doctor");
const Patient = require("../../models/Patient");
const Appointment = require("../../models/Appointment");
const MedicalRecord = require("../../models/Medicalrecord");
const ApiError = require("../../utils/ApiError");

/**
 * Creates a new Digital Prescription
 */
const createPrescription = async (data, doctorUser) => {
  // 1. Find Doctor profile linked to the logged-in doctor user
  const doctorProfile = await Doctor.findOne({ user: doctorUser._id });
  if (!doctorProfile) {
    throw new ApiError(403, "Doctor profile not found. Access denied.");
  }

  let finalPatientId = data.patientId;

  // 2. If medicalRecord is provided, verify it exists and retrieve patientId
  if (data.medicalRecord) {
    const record = await MedicalRecord.findById(data.medicalRecord);
    if (!record) {
      throw new ApiError(404, "Medical record not found.");
    }
    // Verify doctor owns the medical record
    if (record.doctorId.toString() !== doctorProfile._id.toString()) {
      throw new ApiError(403, "Forbidden: This medical record belongs to another doctor.");
    }
    finalPatientId = record.patientId;
  }

  if (!finalPatientId) {
    throw new ApiError(400, "Patient ID is required when medical record is not provided.");
  }

  // 3. Resolve Patient Profile ID
  let patientProfile = await Patient.findById(finalPatientId);
  if (!patientProfile) {
    patientProfile = await Patient.findOne({ user: finalPatientId });
  }
  if (!patientProfile) {
    throw new ApiError(404, "Patient profile not found.");
  }

  // 4. Verify Doctor-Patient assignment via Appointment
  const isAssigned = await Appointment.findOne({
    patient: patientProfile._id,
    doctor: doctorProfile._id,
  });
  if (!isAssigned) {
    throw new ApiError(403, "Forbidden: You cannot issue a prescription for a patient who is not assigned to you.");
  }

  // 5. Create and save prescription
  const prescription = new Prescription({
    medicalRecord: data.medicalRecord || undefined,
    patientId: patientProfile._id,
    doctorId: doctorProfile._id,
    medicines: data.medicines,
    instructions: data.instructions,
    followUpDate: data.followUpDate,
  });

  await prescription.save();
  return prescription;
};

/**
 * Retrieves a single Prescription by ID and performs RBAC verification
 */
const getPrescriptionById = async (id, user) => {
  const prescription = await Prescription.findById(id)
    .populate({
      path: "patientId",
      populate: { path: "user", select: "name email" },
    })
    .populate({
      path: "doctorId",
      populate: { path: "user", select: "name email" },
    })
    .populate("medicalRecord");

  if (!prescription) {
    throw new ApiError(404, "Prescription not found.");
  }

  // RBAC Access Control checks
  if (user.role === "Patient") {
    // A patient can only view their own prescriptions
    const patientUser = prescription.patientId?.user;
    if (!patientUser || patientUser._id.toString() !== user._id.toString()) {
      throw new ApiError(403, "Forbidden: You can only access your own prescriptions.");
    }
  } else if (user.role === "Doctor") {
    // A doctor profile must exist
    const doctorProfile = await Doctor.findOne({ user: user._id });
    if (!doctorProfile) {
      throw new ApiError(403, "Doctor profile not found. Access denied.");
    }

    // Verify if doctor created it, or has an appointment assignment with the patient
    const isCreator = prescription.doctorId._id.toString() === doctorProfile._id.toString();
    if (!isCreator) {
      const isAssigned = await Appointment.findOne({
        patient: prescription.patientId._id,
        doctor: doctorProfile._id,
      });
      if (!isAssigned) {
        throw new ApiError(403, "Forbidden: You are not assigned to this patient.");
      }
    }
  } else if (user.role !== "Admin") {
    throw new ApiError(403, "Forbidden: Unauthorized access.");
  }

  return prescription;
};

/**
 * Retrieves all prescriptions belonging to a specific patient
 */
const getPatientPrescriptions = async (patientId, user) => {
  // Resolve patient profile
  let patientProfile = await Patient.findById(patientId);
  if (!patientProfile) {
    patientProfile = await Patient.findOne({ user: patientId });
  }
  if (!patientProfile) {
    throw new ApiError(404, "Patient profile not found.");
  }

  // RBAC Access Control checks
  if (user.role === "Patient") {
    // Patients can only retrieve their own prescriptions
    if (patientProfile.user.toString() !== user._id.toString()) {
      throw new ApiError(403, "Forbidden: You can only access your own prescriptions.");
    }
  } else if (user.role === "Doctor") {
    // Doctors must be assigned to the patient
    const doctorProfile = await Doctor.findOne({ user: user._id });
    if (!doctorProfile) {
      throw new ApiError(403, "Doctor profile not found. Access denied.");
    }

    const isAssigned = await Appointment.findOne({
      patient: patientProfile._id,
      doctor: doctorProfile._id,
    });
    if (!isAssigned) {
      throw new ApiError(403, "Forbidden: You are not assigned to this patient.");
    }
  } else if (user.role !== "Admin") {
    throw new ApiError(403, "Forbidden: Unauthorized access.");
  }

  // Fetch prescriptions
  return await Prescription.find({ patientId: patientProfile._id })
    .populate({
      path: "patientId",
      populate: { path: "user", select: "name email" },
    })
    .populate({
      path: "doctorId",
      populate: { path: "user", select: "name email" },
    })
    .populate("medicalRecord")
    .sort({ createdAt: -1 });
};

module.exports = {
  createPrescription,
  getPrescriptionById,
  getPatientPrescriptions,
};
