const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const http = require("http");
const { spawn } = require("child_process");
const connectDB = require("./config/db");

// Models to verify data
const User = require("./models/User");
const Patient = require("./models/Patient");
const Doctor = require("./models/Doctor");
const MedicalRecord = require("./models/Medicalrecord");
const Prescription = require("./models/Prescription");
const Appointment = require("./models/Appointment");

const PORT = 6001;
const BASE_URL = `http://localhost:${PORT}`;

// Helper to make promise-based HTTP requests using built-in http module
const apiRequest = (method, endpoint, headers = {}, body = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: PORT,
      path: endpoint,
      method: method.toUpperCase(),
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => {
        responseData += chunk;
      });
      res.on("end", () => {
        let bodyParsed = responseData;
        if (res.headers["content-type"] && res.headers["content-type"].includes("application/json")) {
          try {
            bodyParsed = JSON.parse(responseData);
          } catch (e) {
            // keep as string
          }
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: bodyParsed,
        });
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const runTests = async () => {
  console.log("================================================================================");
  console.log("🔒 STARTING INTEGRATION TEST SUITE: DIGITAL PRESCRIPTION SECURITY & VERIFICATION");
  console.log("================================================================================\n");

  let serverProcess = null;

  try {
    // 1. Connect to DB to manage test data state
    await connectDB();
    console.log("✔ Connected to MongoDB successfully.");

    // Clean up previous test users
    const testEmails = [
      "security_doctor@example.com",
      "security_patient@example.com"
    ];
    const existingUsers = await User.find({ email: { $in: testEmails } });
    const userIds = existingUsers.map((u) => u._id);
    
    const existingPatients = await Patient.find({ user: { $in: userIds } });
    const patientIds = existingPatients.map((p) => p._id);
    const existingDoctors = await Doctor.find({ user: { $in: userIds } });
    const doctorIds = existingDoctors.map((d) => d._id);

    await Appointment.deleteMany({
      $or: [
        { patient: { $in: patientIds } },
        { doctor: { $in: doctorIds } }
      ]
    });
    await Patient.deleteMany({ user: { $in: userIds } });
    await Doctor.deleteMany({ user: { $in: userIds } });
    await MedicalRecord.deleteMany({ patientId: { $in: patientIds } });
    await Prescription.deleteMany({
      $or: [
        { patientId: { $in: patientIds } },
        { doctorId: { $in: doctorIds } }
      ]
    });
    await User.deleteMany({ _id: { $in: userIds } });
    console.log("✔ Cleanup complete.");

    // Start Express Server
    console.log("Starting server process on port " + PORT + "...");
    serverProcess = await new Promise((resolve, reject) => {
      const proc = spawn("node", ["src/server.js"], {
        env: { ...process.env, PORT: String(PORT) },
      });

      let hasStarted = false;

      proc.stdout.on("data", (data) => {
        const text = data.toString();
        if (text.includes(`Server running on port ${PORT}`) || text.includes("MongoDB Connected")) {
          if (!hasStarted) {
            hasStarted = true;
            console.log(`✔ Server spawned and listening on port ${PORT}.`);
            setTimeout(() => resolve(proc), 1000);
          }
        }
      });

      proc.stderr.on("data", (data) => {
        console.error(`[Server Stderr] ${data.toString().trim()}`);
      });

      proc.on("error", (err) => {
        reject(err);
      });
    });

    // 2. Register Users
    console.log("Registering test users...");
    
    // Doctor
    const docRes = await apiRequest("POST", "/api/auth/register", {}, {
      name: "Dr. Security Tester",
      email: "security_doctor@example.com",
      password: "password123",
      role: "Doctor",
      specialization: "Cybersecurity in Healthcare",
      licenseNumber: "LIC-SECURE-999",
      hospital: "MediConnect Secure Lab",
      qualification: "MD, MS",
    });
    if (docRes.statusCode !== 201) throw new Error("Doctor registration failed");
    const docToken = docRes.body.token;
    const docUserId = docRes.body.user.id;
    const doctorProfile = await Doctor.findOne({ user: docUserId });

    // Patient
    const patientRes = await apiRequest("POST", "/api/auth/register", {}, {
      name: "Alice Security",
      email: "security_patient@example.com",
      password: "password123",
      role: "Patient",
      phone: "+15555551212",
      address: "123 Cryptography Ave",
      dateOfBirth: "1995-05-15",
      emergencyContact: "+19999999999",
      allergies: ["None"],
      medicalHistory: ["Healthy"],
      gender: "Female",
      bloodGroup: "A-",
    });
    if (patientRes.statusCode !== 201) throw new Error("Patient registration failed");
    const patientUserId = patientRes.body.user.id;
    const patientProfile = await Patient.findOne({ user: patientUserId });

    // Create appointment to allow access
    const appointment = new Appointment({
      patient: patientProfile._id,
      doctor: doctorProfile._id,
      appointmentDate: new Date(),
      status: "Scheduled",
    });
    await appointment.save();
    console.log("✔ Assigned Doctor to Patient via Appointment.");

    // --- TEST 1: Hash Generation ---
    console.log("\n--- [Test 1] Cryptographic Hash Generation Check ---");
    const prescriptionPayload = {
      patientId: patientProfile._id.toString(),
      medicines: [
        {
          name: "Ibuprofen",
          dosage: "400mg",
          frequency: "Every 8 hours as needed",
          duration: "5 days"
        }
      ],
      instructions: "Take with food.",
      followUpDate: "2026-08-10"
    };

    const createRxRes = await apiRequest("POST", "/api/prescriptions", { Authorization: `Bearer ${docToken}` }, prescriptionPayload);
    if (createRxRes.statusCode !== 201) throw new Error("Prescription creation failed");
    const prescriptionId = createRxRes.body.data._id;
    
    // Fetch directly from Mongo to see if hash field is populated
    const prescriptionDoc = await Prescription.findById(prescriptionId);
    console.log(`[CHECK] Hash exists in DB: "${prescriptionDoc.hash}" (Expected: SHA-256 HMAC String)`);
    if (!prescriptionDoc.hash || prescriptionDoc.hash.length !== 64) {
      throw new Error("Prescription hash generation failed or was invalid.");
    }
    console.log("✔ Cryptographic HMAC hash generated successfully.");

    // --- TEST 2: Immutability Protection ---
    console.log("\n--- [Test 2] Prescription Immutability Verification ---");
    try {
      prescriptionDoc.instructions = "Take with milk instead.";
      await prescriptionDoc.save();
      throw new Error("Security bypass: Modified an issued prescription via save() successfully! (Should have failed)");
    } catch (err) {
      console.log(`[CHECK] Modifying prescription doc failed: "${err.message}" (Expected: Cannot modify an issued prescription.)`);
      if (!err.message.includes("Cannot modify an issued prescription")) {
        throw new Error("Unexpected error message during modification block: " + err.message);
      }
      console.log("✔ Issued prescription immutability verified (save block succeeded).");
    }

    // --- TEST 3: Public Verification Portal ---
    console.log("\n--- [Test 3] Public Verification Endpoint Verification ---");
    // Make request without authorization headers
    const verifyRes = await apiRequest("GET", `/api/prescriptions/${prescriptionId}/verify`);
    console.log(`[CHECK] GET /api/prescriptions/:id/verify: Status = ${verifyRes.statusCode} (Expected: 200)`);
    if (verifyRes.statusCode !== 200) {
      throw new Error("Verification route failed to respond publicly with status 200");
    }
    console.log(`[CHECK] Verification details:
    - valid: ${verifyRes.body.data.valid} (Expected: true)
    - tampered: ${verifyRes.body.data.tampered} (Expected: false)
    - patient name: "${verifyRes.body.data.prescription?.patient?.name}" (Expected: "Alice Security")`);

    if (!verifyRes.body.data.valid || verifyRes.body.data.tampered) {
      throw new Error("Verification logic failed on clean, authentic prescription.");
    }
    console.log("✔ Authentic prescription verification verified.");

    // --- TEST 4: Tamper Detection ---
    console.log("\n--- [Test 4] Tamper Detection Check ---");
    // We will bypass the save middleware by directly calling mongoose updateOne to manipulate DB fields, mimicking direct Mongo hacks
    const originalIvAndCipher = prescriptionDoc.instructions; // Already encrypted format: ivHex:tagHex:cipherHex
    
    // We will artificially replace the encrypted instructions in database with a fake encrypted string
    // Let's encrypt "Take twice as much ibuprofen"
    const { encrypt } = require("./utils/encryption");
    const tamperedInstructions = encrypt("Take twice as much ibuprofen");

    await Prescription.collection.updateOne(
      { _id: prescriptionDoc._id },
      { $set: { instructions: tamperedInstructions } }
    );
    console.log("✔ Artificially tampered with prescription instructions in Mongo collection.");

    // Now call the public verification route again
    const verifyTamperedRes = await apiRequest("GET", `/api/prescriptions/${prescriptionId}/verify`);
    console.log(`[CHECK] GET /api/prescriptions/:id/verify (Tampered): Status = ${verifyTamperedRes.statusCode} (Expected: 200)`);
    console.log(`[CHECK] Tampered Verification details:
    - valid: ${verifyTamperedRes.body.data.valid} (Expected: false)
    - tampered: ${verifyTamperedRes.body.data.tampered} (Expected: true)
    - message: "${verifyTamperedRes.body.data.message}"`);

    if (verifyTamperedRes.body.data.valid || !verifyTamperedRes.body.data.tampered) {
      throw new Error("Security verification failure: Tampered prescription was approved as authentic!");
    }
    console.log("✔ Cryptographic tamper detection verified successfully.");

    // --- CLEAN UP ---
    console.log("\nCleaning up security test data...");
    await Prescription.deleteMany({ patientId: patientProfile._id });
    await Appointment.findByIdAndDelete(appointment._id);
    await Patient.deleteMany({ user: { $in: userIds } });
    await Doctor.deleteMany({ user: { $in: userIds } });
    await User.deleteMany({ _id: { $in: userIds } });
    console.log("✔ Cleanup complete.");

    console.log("\n================================================================================");
    console.log("🎉 ALL PRESCRIPTION SECURITY & VERIFICATION TESTS COMPLETED SUCCESSFULLY!");
    console.log("================================================================================");

    if (serverProcess) {
      serverProcess.kill();
    }
    setTimeout(() => process.exit(0), 1000);
  } catch (error) {
    console.error("\n❌ TEST SUITE FAILED WITH ERROR:");
    console.error(error);
    if (serverProcess) {
      serverProcess.kill();
    }
    setTimeout(() => process.exit(1), 1000);
  }
};

runTests();
