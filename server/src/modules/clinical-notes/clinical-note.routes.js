const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const authorize = require("../../middleware/role");
const { validateBody } = require("../../middleware/validation");
const { createClinicalNoteSchema } = require("./clinical-note.validation");
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

// @route   GET /clinical-notes/:id
// @desc    Get details of a clinical note
// @access  Private (Patient owner, assigned Doctor, or Admin)
router.get(
  "/:id",
  auth,
  clinicalNoteController.getNote
);

module.exports = router;
