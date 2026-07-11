require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");

const app = express();
const auditLogger = require("./middleware/audit");

// 1. HTTP Security Headers
app.use(helmet());

// 2. CORS Policy Hardening
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173"
];

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  // Allow localhost/127.0.0.1 on any port for local development & integration test scripts
  if (/^http:\/\/localhost:\d+$/.test(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) return true;
  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Blocked by CORS policy"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// 3. API Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per 15 minutes
  message: { error: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === "test", // Skip rate limiting during testing to prevent false positives
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // Limit login/register to 30 attempts per 15 minutes
  message: { error: "Too many authentication attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === "test",
});

app.use("/api/", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// Parse JSON payloads
app.use(express.json());
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
app.use("/api/medical-records", require("./routes/records"));
app.use("/medical-records", require("./routes/records"));
app.use("/api/clinical-notes", require("./modules/clinical-notes/clinical-note.routes"));
app.use("/clinical-notes", require("./modules/clinical-notes/clinical-note.routes"));
app.use("/api/prescriptions", require("./modules/prescriptions/prescription.routes"));
app.use("/api", require("./modules/scheduling/scheduling.routes"));
app.use("/", require("./modules/scheduling/scheduling.routes"));

app.get("/", (req, res) => {
  res.send("API Running");
});

const errorHandlerMiddleware = require("./middleware/errorHandler");

// Global Error Handler Middleware (Standardized JSON error handling)
app.use(errorHandlerMiddleware);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});