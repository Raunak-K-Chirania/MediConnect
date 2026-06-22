const AuditLog = require("../models/AuditLog");

/**
 * Centrally log an audit event
 */
const logEvent = async ({
  userId,
  role,
  action,
  resourceType,
  resourceId,
  ipAddress,
  apiEndpoint,
  performedAction,
  method,
  statusCode,
}) => {
  try {
    const auditEntry = new AuditLog({
      timestamp: new Date(),
      userId: userId || null,
      role: role || null,
      action: action || null,
      resourceType: resourceType || null,
      resourceId: resourceId || null,
      ipAddress: ipAddress || "unknown",
      apiEndpoint: apiEndpoint || "unknown",
      performedAction: performedAction || action || "System Action",
      method: method || "SYSTEM",
      statusCode: statusCode || 200,
    });

    await auditEntry.save();
    return auditEntry;
  } catch (error) {
    // Fail silently in production, but print error
    console.error("Central Audit Service - Logging failed:", error);
    return null;
  }
};

module.exports = {
  logEvent,
};
