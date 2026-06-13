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
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Doctor", doctorSchema);