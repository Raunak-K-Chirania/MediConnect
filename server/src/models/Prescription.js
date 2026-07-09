const mongoose = require("mongoose");
const { encrypt, decrypt, encryptMedicines, decryptMedicines } = require("../utils/encryption");

const prescriptionSchema = new mongoose.Schema(
  {
    medicalRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicalRecord",
    },

    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: [true, "Patient reference is required"],
    },

    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: [true, "Doctor reference is required"],
    },

    medicines: {
      type: [
        {
          name: {
            type: String,
            required: [true, "Medicine name is required"],
            trim: true,
          },

          dosage: {
            type: String,
            required: [true, "Medicine dosage is required"],
            trim: true,
          },

          frequency: {
            type: String,
            trim: true,
          },

          duration: {
            type: String,
            trim: true,
          },
        },
      ],
      validate: {
        validator: function (val) {
          return val && val.length > 0;
        },
        message: "A prescription must contain at least one medicine",
      },
    },

    instructions: {
      type: String,
      trim: true,
    },

    followUpDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-validate hook to populate patientId and doctorId from medicalRecord if not provided
prescriptionSchema.pre("validate", async function () {
  if (this.medicalRecord && (!this.patientId || !this.doctorId)) {
    const MedicalRecord = mongoose.model("MedicalRecord");
    const record = await MedicalRecord.findById(this.medicalRecord);
    if (record) {
      if (!this.patientId) this.patientId = record.patientId;
      if (!this.doctorId) this.doctorId = record.doctorId;
    }
  }
});

// Encryption & Decryption Middleware Hooks
prescriptionSchema.pre("save", function () {
  if (this.isModified("medicines") && this.medicines) {
    this.medicines = encryptMedicines(this.medicines);
  }
  if (this.isModified("instructions") && this.instructions) {
    this.instructions = encrypt(this.instructions);
  }
});

const decryptPrescription = (doc) => {
  if (!doc) return;
  if (doc.medicines) doc.medicines = decryptMedicines(doc.medicines);
  if (doc.instructions) doc.instructions = decrypt(doc.instructions);
};

prescriptionSchema.post("init", function (doc) {
  decryptPrescription(doc);
});

prescriptionSchema.post("save", function (doc) {
  decryptPrescription(doc);
});

prescriptionSchema.post("find", function (docs) {
  if (Array.isArray(docs)) {
    docs.forEach(decryptPrescription);
  }
});

prescriptionSchema.post("findOne", function (doc) {
  if (doc) {
    decryptPrescription(doc);
  }
});

// Indexes
prescriptionSchema.index({ medicalRecord: 1 });
prescriptionSchema.index({ patientId: 1 });
prescriptionSchema.index({ doctorId: 1 });

module.exports = mongoose.model("Prescription", prescriptionSchema);

