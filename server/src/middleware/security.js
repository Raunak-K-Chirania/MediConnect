/**
 * Security middleware to protect APIs against NoSQL Injection and Cross-Site Scripting (XSS).
 */

/**
 * Recursively checks if an object contains keys starting with '$' (MongoDB operators).
 * @param {any} obj - The object or value to scan.
 * @returns {boolean} True if a NoSQL operator is found, false otherwise.
 */
const hasNoSqlOperators = (obj) => {
  if (!obj || typeof obj !== "object") return false;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (hasNoSqlOperators(item)) return true;
    }
    return false;
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (key.startsWith("$")) {
        return true;
      }
      if (typeof obj[key] === "object" && hasNoSqlOperators(obj[key])) {
        return true;
      }
    }
  }
  return false;
};

/**
 * Recursively escapes HTML entities in string variables to prevent Cross-Site Scripting (XSS).
 * @param {any} obj - The value to sanitize.
 * @returns {any} The sanitized value.
 */
const sanitizeXss = (obj) => {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    return obj
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;");
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeXss(item));
  }

  if (typeof obj === "object") {
    const sanitized = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeXss(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
};

/**
 * Express middleware to hardens request payloads.
 * Blocks NoSQL injection patterns and sanitizes all inputs from XSS tags.
 */
const securityHardening = (req, res, next) => {
  // 1. Detect and reject NoSQL Injection attempts
  if (hasNoSqlOperators(req.body) || hasNoSqlOperators(req.query) || hasNoSqlOperators(req.params)) {
    return res.status(400).json({
      error: "Malformed or malicious payload detected: dangerous operators are not allowed.",
    });
  }

  // 2. Sanitize user inputs to protect against XSS
  req.body = sanitizeXss(req.body);
  req.query = sanitizeXss(req.query);
  req.params = sanitizeXss(req.params);

  next();
};

module.exports = {
  hasNoSqlOperators,
  sanitizeXss,
  securityHardening,
};
