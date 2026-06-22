/**
 * Standard API Success Response
 */
const successResponse = (res, statusCode, message, data = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Standard API Error Response
 */
const errorResponse = (res, statusCode, message) => {
  return res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = {
  successResponse,
  errorResponse,
};
