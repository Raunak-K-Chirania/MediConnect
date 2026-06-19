const mongoose = require("mongoose");
const { encrypt, decrypt } = require("../../utils/encryption");

const clinicalNoteSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: [true, "Appointment ID is required"],
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Patient ID is required"],
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Doctor ID is required"],
    },
    subjectiveFindings: {
      type: String,
      required: [true, "Subjective findings are required"],
    },
    objectiveFindings: {
      type: String,
      required: [true, "Objective findings are required"],
    },
    assessment: {
      type: String,
      required: [true, "Assessment is required"],
    },
    plan: {
      type: String,
      required: [true, "Plan is required"],
    },
    attachments: {
      type: [String],
      default: [],
    },
    consultationDate: {
      type: Date,
      required: [true, "Consultation date is required"],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
clinicalNoteSchema.index({ patientId: 1 });
clinicalNoteSchema.index({ doctorId: 1 });
clinicalNoteSchema.index({ appointmentId: 1 });
clinicalNoteSchema.index({ consultationDate: 1 });

// Encryption & Decryption Middleware Hooks for PHI fields
clinicalNoteSchema.pre("save", function () {
  if (this.isModified("subjectiveFindings") && this.subjectiveFindings) {
    this.subjectiveFindings = encrypt(this.subjectiveFindings);
  }
  if (this.isModified("objectiveFindings") && this.objectiveFindings) {
    this.objectiveFindings = encrypt(this.objectiveFindings);
  }
  if (this.isModified("assessment") && this.assessment) {
    this.assessment = encrypt(this.assessment);
  }
  if (this.isModified("plan") && this.plan) {
    this.plan = encrypt(this.plan);
  }
});

const decryptClinicalNote = (doc) => {
  if (!doc) return;
  if (doc.subjectiveFindings) doc.subjectiveFindings = decrypt(doc.subjectiveFindings);
  if (doc.objectiveFindings) doc.objectiveFindings = decrypt(doc.objectiveFindings);
  if (doc.assessment) doc.assessment = decrypt(doc.assessment);
  if (doc.plan) doc.plan = decrypt(doc.plan);
};

clinicalNoteSchema.post("init", function (doc) {
  decryptClinicalNote(doc);
});

clinicalNoteSchema.post("save", function (doc) {
  decryptClinicalNote(doc);
});

clinicalNoteSchema.post("find", function (docs) {
  if (Array.isArray(docs)) {
    docs.forEach(decryptClinicalNote);
  }
});

clinicalNoteSchema.post("findOne", function (doc) {
  if (doc) {
    decryptClinicalNote(doc);
  }
});

module.exports = mongoose.model("ClinicalNote", clinicalNoteSchema);
