const { z } = require("zod");
const ApiError = require("../utils/ApiError");
const { errorResponse } = require("../utils/apiResponse");

const errorHandlerMiddleware = (err, req, res, next) => {
  // Log unexpected errors for developers, but hide detailed stack trace from clients
  if (process.env.NODE_ENV !== "test" && !(err instanceof ApiError) && !(err instanceof z.ZodError)) {
    console.error("Unhandled server error:", err);
  }

  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  // Handle ApiError directly
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
  }
  // Handle Zod Validation Errors
  else if (err instanceof z.ZodError) {
    statusCode = 400;
    const issues = err.errors || err.issues || [];
    message = "Validation error: " + issues.map((issue) => {
      const field = issue.path.join(".");
      return field ? `${field}: ${issue.message}` : issue.message;
    }).join("; ");
  }
  // Handle Mongoose CastError (e.g. invalid ObjectId format)
  else if (err.name === "CastError" && err.kind === "ObjectId") {
    statusCode = 400;
    message = `Invalid MongoDB ObjectId format: ${err.value}`;
  }
  // Handle Mongoose ValidationError
  else if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors).map((val) => val.message).join("; ");
  }
  // Handle MongoDB Duplicate Key Error (code 11000)
  else if (err.code === 11000) {
    statusCode = 400;
    message = "Duplicate value entered: resource already exists.";
  }
  // Handle JWT errors
  else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token. Access denied.";
  }
  else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token has expired.";
  }

  // Ensure errors return the standard error response format
  return errorResponse(res, statusCode, message);
};

module.exports = errorHandlerMiddleware;
