const mongoose = require("mongoose");
const { encrypt, decrypt } = require("../utils/encryption");

const appointmentSchema = new mongoose.Schema(
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

        appointmentDate: {
            type: Date,
            required: true,
        },

        reason: {
            type: String,
        },

        status: {
            type: String,
            enum: [
                "Scheduled",
                "Completed",
                "Cancelled",
            ],
            default: "Scheduled",
        },
    },
    {
        timestamps: true,
    }
);

// Encryption & Decryption Middleware Hooks
appointmentSchema.pre("save", function () {
  if (this.isModified("reason") && this.reason) {
    this.reason = encrypt(this.reason);
  }
});

const decryptAppointment = (doc) => {
  if (!doc) return;
  if (doc.reason) doc.reason = decrypt(doc.reason);
};

appointmentSchema.post("init", function (doc) {
  decryptAppointment(doc);
});

appointmentSchema.post("save", function (doc) {
  decryptAppointment(doc);
});

appointmentSchema.post("find", function (docs) {
  if (Array.isArray(docs)) {
    docs.forEach(decryptAppointment);
  }
});

appointmentSchema.post("findOne", function (doc) {
  if (doc) {
    decryptAppointment(doc);
  }
});

module.exports = mongoose.model(
    "Appointment",
    appointmentSchema
);