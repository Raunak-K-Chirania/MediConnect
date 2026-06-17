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

// Connect Database
connectDB();

// Define Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/protected", require("./routes/protected"));
app.use("/api/patients", require("./routes/patients"));
app.use("/api/records", require("./routes/records"));

app.get("/", (req, res) => {
  res.send("API Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});