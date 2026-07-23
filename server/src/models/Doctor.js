const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },

        specialization: {
            type: String,
            required: true,
        },

        qualification: {
            type: String,
        },

        experience: {
            type: Number,
        },

        licenseNumber: {
            type: String,
            required: true,
            unique: true,
        },

        consultationFee: {
            type: Number,
        },

        hospital: {
            type: String,
        },

        available: {
            type: Boolean,
            default: true,
        },

        certificateUrl: {
            type: String,
        },

        certificateNumber: {
            type: String,
        },

        certificateExpiryDate: {
            type: Date,
        },

        verificationStatus: {
            type: String,
            enum: ["Pending", "Approved", "Rejected"],
            default: "Pending",
        },

        verificationNotes: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Doctor", doctorSchema);