const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/role");
const { validateBody } = require("../../middleware/validation");
const { createClinicalNoteSchema, updateClinicalNoteSchema } = require("./clinical-note.validation");
const clinicalNoteController = require("./clinical-note.controller");

// @route   POST /clinical-notes
// @desc    Create a new clinical note
// @access  Private (Doctor only)
router.post(
  "/",
  auth,
  authorize("Doctor"),
  validateBody(createClinicalNoteSchema),
  clinicalNoteController.createNote
);

// @route   GET /clinical-notes/patient/:patientId
// @desc    Get all clinical notes belonging to a patient
// @access  Private (Patient owner, assigned Doctor, or Admin)
router.get(
  "/patient/:patientId",
  auth,
  clinicalNoteController.getPatientNotes
);

// @route   GET /clinical-notes/:id
// @desc    Get details of a clinical note
// @access  Private (Patient owner, assigned Doctor, or Admin)
router.get(
  "/:id",
  auth,
  clinicalNoteController.getNote
);

// @route   PUT /clinical-notes/:id
// @desc    Update an existing clinical note
// @access  Private (Compliance Admin or Authoring Doctor only)
router.put(
  "/:id",
  auth,
  authorize(["Doctor", "Admin"]),
  validateBody(updateClinicalNoteSchema),
  clinicalNoteController.updateNote
);

// @route   DELETE /clinical-notes/:id
// @desc    Soft-delete a clinical note
// @access  Private (Admin or Authoring Doctor only)
router.delete(
  "/:id",
  auth,
  authorize(["Doctor", "Admin"]),
  clinicalNoteController.deleteNote
);

module.exports = router;
