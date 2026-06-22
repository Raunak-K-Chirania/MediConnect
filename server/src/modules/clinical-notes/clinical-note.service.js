const ClinicalNote = require("./clinical-note.model");
const Doctor = require("../../models/Doctor");
const Patient = require("../../models/Patient");
const Appointment = require("../../models/Appointment");
const ApiError = require("../../utils/ApiError");

/**
 * Service to create a new Clinical Note.
 * Verifies doctor-patient relationship, appointment existence, and assignment.
 */
const createClinicalNote = async (data, doctorUser) => {
  // Find Doctor profile linked to the logged-in doctor user
  const doctorProfile = await Doctor.findOne({ user: doctorUser._id });
  if (!doctorProfile) {
    throw new ApiError(403, "Doctor profile not found. Access denied.");
  }

  // Ensure body's doctorId matches the logged-in doctor user's ID
  if (data.doctorId.toString() !== doctorUser._id.toString()) {
    throw new ApiError(403, "Forbidden: You cannot create a clinical note on behalf of another doctor.");
  }

  // 1. Verify appointment exists
  const appointment = await Appointment.findById(data.appointmentId);
  if (!appointment) {
    throw new ApiError(404, "Appointment not found.");
  }

  // 2. Verify appointment belongs to requesting doctor
  if (appointment.doctor.toString() !== doctorProfile._id.toString()) {
    throw new ApiError(403, "Forbidden: This appointment is not assigned to you.");
  }

  // 3. Verify patient relationship
  // Fetch patient profile corresponding to patientId (which is User ID)
  const patientProfile = await Patient.findOne({ user: data.patientId });
  if (!patientProfile) {
    throw new ApiError(404, "Patient profile not found.");
  }

  // Verify that the appointment is indeed for this patient
  if (appointment.patient.toString() !== patientProfile._id.toString()) {
    throw new ApiError(403, "Forbidden: The specified patient does not match this appointment.");
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
  const note = await ClinicalNote.findOne({ _id: noteId, isDeleted: { $ne: true } });
  if (!note) {
    throw new ApiError(404, "Clinical note not found");
  }

  // RBAC Access Control checks
  if (user.role === "Patient") {
    if (note.patientId.toString() !== user._id.toString()) {
      throw new ApiError(403, "Forbidden: You can only access your own clinical notes.");
    }
  } else if (user.role === "Doctor") {
    // Find Doctor profile linked to the logged-in user
    const doctorProfile = await Doctor.findOne({ user: user._id });
    if (!doctorProfile) {
      throw new ApiError(403, "Doctor profile not found. Access denied.");
    }

    // Check if patient profile exists for the note's patientId User
    const patientProfile = await Patient.findOne({ user: note.patientId });
    if (!patientProfile) {
      throw new ApiError(404, "Patient profile not found for this clinical note.");
    }

    // Verify if there is an appointment assigning this patient to this doctor
    const isAssigned = await Appointment.findOne({
      patient: patientProfile._id,
      doctor: doctorProfile._id,
    });

    if (!isAssigned) {
      throw new ApiError(403, "Forbidden: You are not assigned to this patient.");
    }
  } else if (user.role !== "Admin") {
    throw new ApiError(403, "Forbidden: Access denied.");
  }

  // Populate doctor (user details) and patient (user details)
  const populatedNote = await ClinicalNote.findOne({ _id: noteId, isDeleted: { $ne: true } })
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

/**
 * Service to retrieve patient notes with pagination, sorting and access rules.
 */
const getPatientClinicalNotes = async (patientId, user, options = {}) => {
  // 1. Validate patient existence (matches by Patient Profile ID or User ID)
  let patientProfile = await Patient.findById(patientId);
  if (!patientProfile) {
    // Try looking up Patient profile by User ID
    patientProfile = await Patient.findOne({ user: patientId });
  }

  if (!patientProfile) {
    throw new ApiError(404, "Patient profile not found");
  }

  const patientUserId = patientProfile.user.toString();

  // 2. RBAC Access Control checks
  if (user.role === "Patient") {
    if (user._id.toString() !== patientUserId) {
      throw new ApiError(403, "Forbidden: You can only access your own clinical notes.");
    }
  } else if (user.role === "Doctor") {
    // Find Doctor profile linked to the logged-in user
    const doctorProfile = await Doctor.findOne({ user: user._id });
    if (!doctorProfile) {
      throw new ApiError(403, "Doctor profile not found. Access denied.");
    }

    // Verify if doctor is assigned to this patient
    const isAssigned = await Appointment.findOne({
      patient: patientProfile._id,
      doctor: doctorProfile._id,
    });

    if (!isAssigned) {
      throw new ApiError(403, "Forbidden: You are not assigned to this patient.");
    }
  } else if (user.role !== "Admin") {
    throw new ApiError(403, "Forbidden: Access denied.");
  }

  // 3. Pagination & Sorting
  const page = parseInt(options.page, 10) || 1;
  const limit = parseInt(options.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const query = { patientId: patientUserId, isDeleted: { $ne: true } };

  const total = await ClinicalNote.countDocuments(query);
  const notes = await ClinicalNote.find(query)
    .sort({ consultationDate: -1 })
    .skip(skip)
    .limit(limit)
    .populate({
      path: "doctorId",
      select: "name email role",
    })
    .populate("appointmentId");

  return {
    notes,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Service to update an existing clinical note.
 */
const updateClinicalNote = async (noteId, updateData, user) => {
  const note = await ClinicalNote.findOne({ _id: noteId, isDeleted: { $ne: true } });
  if (!note) {
    throw new ApiError(404, "Clinical note not found");
  }

  // RBAC Access Control: Only compliance Admins or the Authoring Doctor
  if (user.role === "Doctor") {
    if (note.doctorId.toString() !== user._id.toString()) {
      throw new ApiError(403, "Forbidden: You are not authorized to update this clinical note.");
    }
  } else if (user.role !== "Admin") {
    throw new ApiError(403, "Forbidden: Access denied.");
  }

  // Restrict updates to valid fields
  const approvedFields = [
    "subjectiveFindings",
    "objectiveFindings",
    "assessment",
    "plan",
    "attachments",
    "consultationDate",
  ];

  approvedFields.forEach((field) => {
    if (updateData[field] !== undefined) {
      note[field] = updateData[field];
    }
  });

  await note.save();
  return note;
};

/**
 * Service to soft-delete an existing clinical note.
 */
const deleteClinicalNote = async (noteId, user) => {
  const note = await ClinicalNote.findOne({ _id: noteId, isDeleted: { $ne: true } });
  if (!note) {
    throw new ApiError(404, "Clinical note not found");
  }

  // RBAC Access Control: Allowed: Admin or Authoring Doctor
  if (user.role === "Doctor") {
    if (note.doctorId.toString() !== user._id.toString()) {
      throw new ApiError(403, "Forbidden: You are not authorized to delete this clinical note.");
    }
  } else if (user.role !== "Admin") {
    throw new ApiError(403, "Forbidden: Access denied.");
  }

  note.isDeleted = true;
  note.deletedAt = new Date();
  await note.save();
  return note;
};

module.exports = {
  createClinicalNote,
  getClinicalNoteById,
  getPatientClinicalNotes,
  updateClinicalNote,
  deleteClinicalNote,
};
