const mongoose = require("mongoose");
const { encrypt, decrypt, encryptArray, decryptArray } = require("../utils/encryption");

const medicalRecordSchema = new mongoose.Schema(
    {
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Patient",
            required: true,
        },

        doctor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Doctor",
            required: true,
        },

        appointment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Appointment",
        },

        diagnosis: {
            type: String,
            required: true,
        },

        symptoms: [String],

        notes: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

// Encryption & Decryption Middleware Hooks
medicalRecordSchema.pre("save", function () {
  if (this.isModified("diagnosis") && this.diagnosis) {
    this.diagnosis = encrypt(this.diagnosis);
  }
  if (this.isModified("symptoms") && this.symptoms) {
    this.symptoms = encryptArray(this.symptoms);
  }
  if (this.isModified("notes") && this.notes) {
    this.notes = encrypt(this.notes);
  }
});

const decryptMedicalRecord = (doc) => {
  if (!doc) return;
  if (doc.diagnosis) doc.diagnosis = decrypt(doc.diagnosis);
  if (doc.symptoms) doc.symptoms = decryptArray(doc.symptoms);
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