const clinicalNoteService = require("./clinical-note.service");
const { successResponse } = require("../../utils/apiResponse");

/**
 * Controller to handle Clinical Note creation.
 */
const createNote = async (req, res, next) => {
  try {
    const note = await clinicalNoteService.createClinicalNote(req.body, req.user);

    // Set rich audit logging context for middleware
    req.auditLogData = {
      action: "CLINICAL_NOTE_CREATED",
      resourceType: "ClinicalNote",
      resourceId: note._id,
    };

    return successResponse(res, 201, "Clinical note created successfully", note);
  } catch (error) {
    return next(error);
  }
};

/**
 * Controller to handle retrieving a single Clinical Note details.
 */
const getNote = async (req, res, next) => {
  try {
    const note = await clinicalNoteService.getClinicalNoteById(req.params.id, req.user);

    // Set rich audit logging context for middleware
    req.auditLogData = {
      action: "CLINICAL_NOTE_VIEWED",
      resourceType: "ClinicalNote",
      resourceId: note._id,
    };

    return successResponse(res, 200, "Clinical note retrieved successfully", note);
  } catch (error) {
    return next(error);
  }
};

/**
 * Controller to retrieve all notes belonging to a patient with pagination & sorting.
 */
const getPatientNotes = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const { page, limit } = req.query;

    const result = await clinicalNoteService.getPatientClinicalNotes(
      patientId,
      req.user,
      { page, limit }
    );

    // Set rich audit logging context for middleware
    req.auditLogData = {
      action: "CLINICAL_NOTE_VIEWED",
      resourceType: "ClinicalNote",
    };

    return successResponse(res, 200, "Patient clinical notes retrieved successfully", result);
  } catch (error) {
    return next(error);
  }
};

/**
 * Controller to partially update an existing clinical note.
 */
const updateNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updatedNote = await clinicalNoteService.updateClinicalNote(id, req.body, req.user);

    // Set rich audit logging context for middleware
    req.auditLogData = {
      action: "CLINICAL_NOTE_UPDATED",
      resourceType: "ClinicalNote",
      resourceId: updatedNote._id,
    };

    return successResponse(res, 200, "Clinical note updated successfully", updatedNote);
  } catch (error) {
    return next(error);
  }
};

/**
 * Controller to soft-delete an existing clinical note.
 */
const deleteNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deletedNote = await clinicalNoteService.deleteClinicalNote(id, req.user);

    // Set rich audit logging context for middleware
    req.auditLogData = {
      action: "CLINICAL_NOTE_DELETED",
      resourceType: "ClinicalNote",
      resourceId: deletedNote._id,
    };

    return successResponse(res, 200, "Clinical note deleted successfully");
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createNote,
  getNote,
  getPatientNotes,
  updateNote,
  deleteNote,
};
