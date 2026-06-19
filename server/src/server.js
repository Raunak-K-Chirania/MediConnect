require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();
const auditLogger = require("./middleware/audit");

// Init Middleware
app.use(express.json());
app.use(cors());
app.use(auditLogger);

const { securityHardening } = require("./middleware/security");
app.use(securityHardening);

// Connect Database
connectDB();

// Define Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/protected", require("./routes/protected"));
app.use("/api/patients", require("./routes/patients"));
app.use("/api/records", require("./routes/records"));
app.use("/medical-records", require("./routes/records"));
app.use("/clinical-notes", require("./modules/clinical-notes/clinical-note.routes"));

app.get("/", (req, res) => {
  res.send("API Running");
});

// Global Error Handler Middleware (Standardized JSON error handling)
app.use((err, req, res, next) => {
  console.error("Global Error Handler Catch:", err);

  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  // Handle Mongoose CastError (e.g. invalid ObjectId format)
  if (err.name === "CastError" && err.kind === "ObjectId") {
    statusCode = 400;
    message = `Invalid MongoDB ObjectId format: ${err.value}`;
  }

  // Handle Mongoose ValidationError
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors).map((val) => val.message).join("; ");
  }

  // Handle MongoDB Duplicate Key Error (code 11000)
  if (err.code === 11000) {
    statusCode = 400;
    message = "Duplicate value entered: resource already exists.";
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token. Access denied.";
  }
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token has expired.";
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});