const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(401, "Access denied. No token provided.");
    }

    const token = authHeader.replace("Bearer ", "");
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === "production") {
      throw new ApiError(500, "JWT_SECRET environment variable is missing.");
    }

    let decoded;
    try {
      decoded = jwt.verify(token, secret || "fallback_secret");
    } catch (jwtErr) {
      if (jwtErr.name === "TokenExpiredError") {
        throw new ApiError(401, "Token has expired. Access denied.");
      }
      throw new ApiError(401, "Invalid token. Access denied.");
    }
    
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      throw new ApiError(401, "Access denied. User not found.");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = auth;
