const ApiError = require("../utils/ApiError");

const normalizeRole = (role) => {
  if (typeof role !== "string") return role;
  const lower = role.toLowerCase();
  if (lower === "admin") return "Admin";
  if (lower === "doctor") return "Doctor";
  if (lower === "patient") return "Patient";
  return role;
};

const authorize = (roles = []) => {
  if (typeof roles === "string") {
    roles = [roles];
  }
  const normalizedRoles = roles.map(normalizeRole);

  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, "Unauthorized. User context missing.");
    }

    if (normalizedRoles.length && !normalizedRoles.includes(req.user.role)) {
      throw new ApiError(
        403,
        `Forbidden: Access restricted to roles: [${normalizedRoles.join(", ")}]`
      );
    }

    next();
  };
};

const authorizeRoles = (...roles) => {
  const flatRoles = roles.flat();
  return authorize(flatRoles);
};

module.exports = authorize;
module.exports.authorize = authorize;
module.exports.authorizeRoles = authorizeRoles;
