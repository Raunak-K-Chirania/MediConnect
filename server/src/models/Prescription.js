const mongoose = require("mongoose");

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

// Indexes
prescriptionSchema.index({ medicalRecord: 1 });

module.exports = mongoose.model("Prescription", prescriptionSchema);
