const clinicalNoteService = require("./clinical-note.service");

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

    res.status(201).json({
      success: true,
      message: "Clinical note created successfully",
      data: note,
    });
  } catch (error) {
    next(error);
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

    res.status(200).json({
      success: true,
      data: note,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createNote,
  getNote,
};
