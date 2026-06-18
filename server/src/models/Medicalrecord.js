const mongoose = require("mongoose");
const { encrypt, decrypt, encryptArray, decryptArray } = require("../utils/encryption");

const medicalRecordSchema = new mongoose.Schema(
    {
        patientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Patient",
            required: [true, "Patient ID is required"],
        },

        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Doctor",
            required: [true, "Doctor ID is required"],
        },

        diagnosis: {
            type: String,
            required: [true, "Diagnosis is required"],
        },

        symptoms: {
            type: [String],
            default: [],
        },

        treatmentPlan: {
            type: String,
            required: [true, "Treatment plan is required"],
        },

        medications: {
            type: [String],
            default: [],
        },

        allergies: {
            type: [String],
            default: [],
        },

        notes: {
            type: String,
            default: "",
        },

        visitDate: {
            type: Date,
            required: [true, "Visit date is required"],
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for frequently queried fields
medicalRecordSchema.index({ patientId: 1 });
medicalRecordSchema.index({ doctorId: 1 });
medicalRecordSchema.index({ visitDate: -1 });

// Encryption & Decryption Middleware Hooks
medicalRecordSchema.pre("save", function () {
  if (this.isModified("diagnosis") && this.diagnosis) {
    this.diagnosis = encrypt(this.diagnosis);
  }
  if (this.isModified("symptoms") && this.symptoms) {
    this.symptoms = encryptArray(this.symptoms);
  }
  if (this.isModified("treatmentPlan") && this.treatmentPlan) {
    this.treatmentPlan = encrypt(this.treatmentPlan);
  }
  if (this.isModified("medications") && this.medications) {
    this.medications = encryptArray(this.medications);
  }
  if (this.isModified("allergies") && this.allergies) {
    this.allergies = encryptArray(this.allergies);
  }
  if (this.isModified("notes") && this.notes) {
    this.notes = encrypt(this.notes);
  }
});

const decryptMedicalRecord = (doc) => {
  if (!doc) return;
  if (doc.diagnosis) doc.diagnosis = decrypt(doc.diagnosis);
  if (doc.symptoms) doc.symptoms = decryptArray(doc.symptoms);
  if (doc.treatmentPlan) doc.treatmentPlan = decrypt(doc.treatmentPlan);
  if (doc.medications) doc.medications = decryptArray(doc.medications);
  if (doc.allergies) doc.allergies = decryptArray(doc.allergies);
  if (doc.notes) doc.notes = decrypt(doc.notes);
};

medicalRecordSchema.post("init", function (doc) {
  decryptMedicalRecord(doc);
});

medicalRecordSchema.post("save", function (doc) {
  decryptMedicalRecord(doc);
});

medicalRecordSchema.post("find", function (docs) {
  if (Array.isArray(docs)) {
    docs.forEach(decryptMedicalRecord);
  }
});

medicalRecordSchema.post("findOne", function (doc) {
  if (doc) {
    decryptMedicalRecord(doc);
  }
});

module.exports = mongoose.model(
    "MedicalRecord",
    medicalRecordSchema
);