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
app.use("/api/medical-records", require("./routes/records"));
app.use("/medical-records", require("./routes/records"));
app.use("/api/clinical-notes", require("./modules/clinical-notes/clinical-note.routes"));
app.use("/clinical-notes", require("./modules/clinical-notes/clinical-note.routes"));
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