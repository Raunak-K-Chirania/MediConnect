const mongoose = require("mongoose");
const { encrypt, decrypt, encryptMedicines, decryptMedicines } = require("../utils/encryption");

const prescriptionSchema = new mongoose.Schema(
  {
    medicalRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MedicalRecord",
      required: [true, "Medical record reference is required"],
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
  },
  {
    timestamps: true,
  }
);

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

module.exports = mongoose.model("Prescription", prescriptionSchema);

