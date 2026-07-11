const mongoose = require("mongoose");
const { encrypt, decrypt, isEncrypted } = require("../utils/encryption");

const appointmentSchema = new mongoose.Schema(
    {
        // Legacy Fields (kept for backwards compatibility)
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Patient",
        },
        doctor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Doctor",
        },
        reason: {
            type: String,
        },

        // New Fields
        patientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        doctorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        appointmentDate: {
            type: Date,
            required: true,
        },
        startTime: {
            type: String, // "HH:MM"
            required: true,
        },
        endTime: {
            type: String, // "HH:MM"
            required: true,
        },
        appointmentType: {
            type: String,
            required: true,
        },
        reasonForVisit: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: [
                "pending",
                "approved",
                "rejected",
                "cancelled",
                "completed",
                // Legacy values mapped
                "Scheduled",
                "Completed",
                "Cancelled",
            ],
            default: "pending",
        },
        notes: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for performance and efficient querying
appointmentSchema.index({ doctorId: 1 });
appointmentSchema.index({ appointmentDate: 1 });
appointmentSchema.index({ doctorId: 1, appointmentDate: 1 });

// Pre-validate synchronization hook
appointmentSchema.pre("validate", async function () {
    try {
        // Sync legacy Patient (Patient model) -> patientId (User model)
        if (this.patient && !this.patientId) {
            const Patient = mongoose.model("Patient");
            const patientProfile = await Patient.findById(this.patient);
            if (patientProfile) {
                this.patientId = patientProfile.user;
            }
        }

        // Sync legacy Doctor (Doctor model) -> doctorId (User model)
        if (this.doctor && !this.doctorId) {
            const Doctor = mongoose.model("Doctor");
            const doctorProfile = await Doctor.findById(this.doctor);
            if (doctorProfile) {
                this.doctorId = doctorProfile.user;
            }
        }

        // Sync patientId (User model) -> legacy Patient (Patient model)
        if (this.patientId && !this.patient) {
            const Patient = mongoose.model("Patient");
            const patientProfile = await Patient.findOne({ user: this.patientId });
            if (patientProfile) {
                this.patient = patientProfile._id;
            }
        }

        // Sync doctorId (User model) -> legacy Doctor (Doctor model)
        if (this.doctorId && !this.doctor) {
            const Doctor = mongoose.model("Doctor");
            const doctorProfile = await Doctor.findOne({ user: this.doctorId });
            if (doctorProfile) {
                this.doctor = doctorProfile._id;
            }
        }

        // Set defaults for required fields if saving legacy
        if (!this.startTime) {
            this.startTime = "09:00";
        }
        if (!this.endTime) {
            this.endTime = "09:30";
        }
        if (!this.appointmentType) {
            this.appointmentType = "General Consultation";
        }
        if (!this.reasonForVisit) {
            this.reasonForVisit = this.reason || "Routine Checkup";
        }
        if (!this.reason) {
            this.reason = this.reasonForVisit;
        }

        // Map legacy statuses to standard statuses
        const legacyToNew = {
            "Scheduled": "approved",
            "Completed": "completed",
            "Cancelled": "cancelled",
        };
        if (this.status && legacyToNew[this.status]) {
            this.status = legacyToNew[this.status];
        }
        if (!this.status) {
            this.status = "pending";
        }

        // Handle Encryption of PHI fields
        if (this.isModified("reason") && this.reason && !isEncrypted(this.reason)) {
            this.reason = encrypt(this.reason);
        }
        if (this.isModified("reasonForVisit") && this.reasonForVisit && !isEncrypted(this.reasonForVisit)) {
            this.reasonForVisit = encrypt(this.reasonForVisit);
        }
    } catch (err) {
        throw err;
    }
});

const decryptAppointment = (doc) => {
    if (!doc) return;
    if (doc.reason) doc.reason = decrypt(doc.reason);
    if (doc.reasonForVisit) doc.reasonForVisit = decrypt(doc.reasonForVisit);
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

module.exports = mongoose.model("Appointment", appointmentSchema);

