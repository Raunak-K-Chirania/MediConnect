const AuditLog = require("../models/AuditLog");

/**
 * Maps HTTP method and matched route path to a human-readable action description.
 */
const getPerformedAction = (method, matchedRoute, rawUrl) => {
  const routeKey = `${method.toUpperCase()} ${matchedRoute}`;
  
  const actionMap = {
    "POST /api/auth/register": "User Registration",
    "POST /api/auth/login": "User Login",
    "GET /api/auth/me": "Retrieve Current User Profile",
    
    "GET /api/protected/patient": "Access Protected Patient Route",
    "GET /api/protected/doctor": "Access Protected Doctor Route",
    "GET /api/protected/admin": "Access Protected Admin Route",
    "GET /api/protected/staff": "Access Protected Staff Route",
    
    "GET /api/patients/me": "Retrieve Own Patient Profile",
    "PUT /api/patients/me": "Update Own Patient Profile",
    "GET /api/patients/:id": "Retrieve Patient Profile By ID",
    
    "POST /api/records": "Create Medical Record and Prescription",
    "GET /api/records/patient/:patientId": "Retrieve Patient Medical Records",
    "GET /api/records/:id": "Retrieve Medical Record Details",
    "POST /medical-records": "Create Medical Record and Prescription",
    "GET /medical-records/patient/:patientId": "Retrieve Patient Medical Records",
    "GET /medical-records/:id": "Retrieve Medical Record Details",
  };

  return actionMap[routeKey] || `${method.toUpperCase()} ${rawUrl}`;
};

/**
 * Express middleware for audit logging.
 * Captures request details and persists them to the AuditLog database collection on response finish.
 */
const auditLogger = (req, res, next) => {
  const startTime = new Date();

  // Listen to response finish event to capture exact status code and late-bound req properties (e.g. req.user)
  res.on("finish", async () => {
    try {
      // Extract IP address (handle proxy forwarding and clean up IPv4-mapped IPv6 loopback)
      let ipAddress = req.headers["x-forwarded-for"] || req.ip || req.socket.remoteAddress || "unknown";
      if (typeof ipAddress === "string" && ipAddress.startsWith("::ffff:")) {
        ipAddress = ipAddress.substring(7);
      }

      // Reconstruct matched route template if available, fallback to raw URL path
      let matchedRoute = req.route
        ? `${req.baseUrl || ""}${req.route.path}`
        : req.path;

      // Normalize matchedRoute by removing trailing slash unless it's exactly "/"
      if (typeof matchedRoute === "string" && matchedRoute.length > 1 && matchedRoute.endsWith("/")) {
        matchedRoute = matchedRoute.slice(0, -1);
      }

      const apiEndpoint = req.originalUrl || req.url;
      const performedAction = getPerformedAction(req.method, matchedRoute, apiEndpoint);
      
      // Try to get user ID from req.user (populated by auth middleware)
      // or req.auditUserId (explicitly populated in login/register controllers)
      const userId = req.user ? req.user._id : (req.auditUserId || null);
      const role = req.user ? req.user.role : null;
      
      const logData = req.auditLogData || {};

      const auditEntry = new AuditLog({
        timestamp: startTime,
        userId,
        role,
        action: logData.action || null,
        resourceType: logData.resourceType || null,
        resourceId: logData.resourceId || null,
        ipAddress,
        apiEndpoint,
        performedAction,
        method: req.method,
        statusCode: res.statusCode,
      });

      await auditEntry.save();
    } catch (err) {
      // Fail silently to prevent crashing the server on logging failures, but write to console error
      console.error("Audit logging failed:", err);
    }
  });

  next();
};

module.exports = auditLogger;
