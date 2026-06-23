const mongoose = require("mongoose");

const breakSlotSchema = new mongoose.Schema(
  {
    start: {
      type: String, // "HH:MM"
      required: true,
    },
    end: {
      type: String, // "HH:MM"
      required: true,
    },
  },
  { _id: false }
);

const doctorAvailabilitySchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // One availability record per doctor
    },
    workingDays: {
      type: [String],
      required: true,
    },
    startHour: {
      type: String, // "HH:MM"
      required: true,
    },
    endHour: {
      type: String, // "HH:MM"
      required: true,
    },
    slotDuration: {
      type: Number, // In minutes, e.g., 30
      required: true,
    },
    breakSlots: [breakSlotSchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("DoctorAvailability", doctorAvailabilitySchema);
