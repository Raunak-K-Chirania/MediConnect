const ClinicalNote = require("./clinical-note.model");
const Doctor = require("../../models/Doctor");
const Patient = require("../../models/Patient");
const Appointment = require("../../models/Appointment");

/**
 * Service to create a new Clinical Note.
 * Verifies doctor-patient relationship, appointment existence, and assignment.
 */
const createClinicalNote = async (data, doctorUser) => {
  // Find Doctor profile linked to the logged-in doctor user
  const doctorProfile = await Doctor.findOne({ user: doctorUser._id });
  if (!doctorProfile) {
    const error = new Error("Doctor profile not found. Access denied.");
    error.statusCode = 403;
    throw error;
  }

  // Ensure body's doctorId matches the logged-in doctor user's ID
  if (data.doctorId.toString() !== doctorUser._id.toString()) {
    const error = new Error("Forbidden: You cannot create a clinical note on behalf of another doctor.");
    error.statusCode = 403;
    throw error;
  }

  // 1. Verify appointment exists
  const appointment = await Appointment.findById(data.appointmentId);
  if (!appointment) {
    const error = new Error("Appointment not found.");
    error.statusCode = 404;
    throw error;
  }

  // 2. Verify appointment belongs to requesting doctor
  if (appointment.doctor.toString() !== doctorProfile._id.toString()) {
    const error = new Error("Forbidden: This appointment is not assigned to you.");
    error.statusCode = 403;
    throw error;
  }

  // 3. Verify patient relationship
  // Fetch patient profile corresponding to patientId (which is User ID)
  const patientProfile = await Patient.findOne({ user: data.patientId });
  if (!patientProfile) {
    const error = new Error("Patient profile not found.");
    error.statusCode = 404;
    throw error;
  }

  // Verify that the appointment is indeed for this patient
  if (appointment.patient.toString() !== patientProfile._id.toString()) {
    const error = new Error("Forbidden: The specified patient does not match this appointment.");
    error.statusCode = 403;
    throw error;
  }

  // Create clinical note
  const clinicalNote = new ClinicalNote({
    appointmentId: data.appointmentId,
    patientId: data.patientId,
    doctorId: data.doctorId,
    subjectiveFindings: data.subjectiveFindings,
    objectiveFindings: data.objectiveFindings,
    assessment: data.assessment,
    plan: data.plan,
    attachments: data.attachments || [],
    consultationDate: data.consultationDate,
  });

  await clinicalNote.save();
  return clinicalNote;
};

/**
 * Service to fetch a Clinical Note by ID.
 * Enforces RBAC access controls:
 * - Patient: Can view only their own notes.
 * - Doctor: Can view notes belonging to assigned patients (via Appointment).
 * - Admin: Can view all notes.
 */
const getClinicalNoteById = async (noteId, user) => {
  const note = await ClinicalNote.findById(noteId);
  if (!note) {
    const error = new Error("Clinical note not found");
    error.statusCode = 404;
    throw error;
  }

  // RBAC Access Control checks
  if (user.role === "Patient") {
    if (note.patientId.toString() !== user._id.toString()) {
      const error = new Error("Forbidden: You can only access your own clinical notes.");
      error.statusCode = 403;
      throw error;
    }
  } else if (user.role === "Doctor") {
    // Find Doctor profile linked to the logged-in user
    const doctorProfile = await Doctor.findOne({ user: user._id });
    if (!doctorProfile) {
      const error = new Error("Doctor profile not found. Access denied.");
      error.statusCode = 403;
      throw error;
    }

    // Check if patient profile exists for the note's patientId User
    const patientProfile = await Patient.findOne({ user: note.patientId });
    if (!patientProfile) {
      const error = new Error("Patient profile not found for this clinical note.");
      error.statusCode = 404;
      throw error;
    }

    // Verify if there is an appointment assigning this patient to this doctor
    const isAssigned = await Appointment.findOne({
      patient: patientProfile._id,
      doctor: doctorProfile._id,
    });

    if (!isAssigned) {
      const error = new Error("Forbidden: You are not assigned to this patient.");
      error.statusCode = 403;
      throw error;
    }
  } else if (user.role !== "Admin") {
    const error = new Error("Forbidden: Access denied.");
    error.statusCode = 403;
    throw error;
  }

  // Populate doctor (user details) and patient (user details)
  const populatedNote = await ClinicalNote.findById(noteId)
    .populate({
      path: "patientId",
      select: "name email role",
    })
    .populate({
      path: "doctorId",
      select: "name email role",
    });

  return populatedNote;
};

module.exports = {
  createClinicalNote,
  getClinicalNoteById,
};
