const mongoose = require("mongoose");
const { encrypt, decrypt, encryptArray, decryptArray } = require("../utils/encryption");

const patientSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },

        dateOfBirth: {
            type: String,
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

// Encryption & Decryption Middleware Hooks
patientSchema.pre("save", function () {
  if (this.isModified("dateOfBirth") && this.dateOfBirth) {
    this.dateOfBirth = encrypt(this.dateOfBirth);
  }
  if (this.isModified("phone") && this.phone) {
    this.phone = encrypt(this.phone);
  }
  if (this.isModified("address") && this.address) {
    this.address = encrypt(this.address);
  }
  if (this.isModified("emergencyContact") && this.emergencyContact) {
    this.emergencyContact = encrypt(this.emergencyContact);
  }
  if (this.isModified("allergies") && this.allergies) {
    this.allergies = encryptArray(this.allergies);
  }
  if (this.isModified("medicalHistory") && this.medicalHistory) {
    this.medicalHistory = encryptArray(this.medicalHistory);
  }
});

const decryptPatient = (doc) => {
  if (!doc) return;
  if (doc.dateOfBirth) doc.dateOfBirth = decrypt(doc.dateOfBirth);
  if (doc.phone) doc.phone = decrypt(doc.phone);
  if (doc.address) doc.address = decrypt(doc.address);
  if (doc.emergencyContact) doc.emergencyContact = decrypt(doc.emergencyContact);
  if (doc.allergies) doc.allergies = decryptArray(doc.allergies);
  if (doc.medicalHistory) doc.medicalHistory = decryptArray(doc.medicalHistory);
};

patientSchema.post("init", function (doc) {
  decryptPatient(doc);
});

patientSchema.post("save", function (doc) {
  decryptPatient(doc);
});

patientSchema.post("find", function (docs) {
  if (Array.isArray(docs)) {
    docs.forEach(decryptPatient);
  }
});

patientSchema.post("findOne", function (doc) {
  if (doc) {
    decryptPatient(doc);
  }
});

// Indexes
patientSchema.index({ phone: 1 });

module.exports = mongoose.model("Patient", patientSchema);
