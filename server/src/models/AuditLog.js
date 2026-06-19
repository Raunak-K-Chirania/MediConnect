const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    ipAddress: {
      type: String,
      required: true,
    },
    apiEndpoint: {
      type: String,
      required: true,
    },
    performedAction: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      default: null,
    },
    resourceType: {
      type: String,
      default: null,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    method: {
      type: String,
      required: true,
    },
    statusCode: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: false, // We use explicit timestamp field
  }
);

// Indexing for searchability and performance
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ performedAction: 1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
