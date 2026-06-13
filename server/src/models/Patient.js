const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },

        dateOfBirth: {
            type: Date,
        },

        gender: {
            type: String,
            enum: {
                values: ["Male", "Female", "Other"],
                message: "{VALUE} is not a valid gender option"
            },
        },

        bloodGroup: {
            type: String,
            enum: {
                values: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
                message: "{VALUE} is not a valid blood group"
            },
        },

        phone: {
            type: String,
            trim: true,
            match: [
                /^\+?[0-9\s\-]{7,15}$/,
                "Please provide a valid phone number (7-15 digits)"
            ],
        },

        address: {
            type: String,
            trim: true,
        },

        emergencyContact: {
            type: String,
            trim: true,
            match: [
                /^\+?[0-9\s\-]{7,15}$/,
                "Please provide a valid emergency contact phone number"
            ],
        },

        allergies: [
            {
                type: String,
                trim: true,
            }
        ],

        medicalHistory: [
            {
                type: String,
                trim: true,
            }
        ],
    },
    {
        timestamps: true,
    }
);

// Indexes
patientSchema.index({ phone: 1 });
patientSchema.index({ user: 1 });

module.exports = mongoose.model("Patient", patientSchema);