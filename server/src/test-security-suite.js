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
const AuditLog = require("./models/AuditLog");

const PORT = 5999;
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

// Helper to poll database for audit logs, preventing test race conditions due to async logging I/O
const waitForAuditLog = async (query, retries = 15, delay = 100) => {
  for (let i = 0; i < retries; i++) {
    const log = await AuditLog.findOne(query).sort({ timestamp: -1 });
    if (log) return log;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return null;
};

const runSecuritySuite = async () => {
  console.log("================================================================================");
  console.log("🔒 STARTING INTEGRATION TEST SUITE: LOGGING, AUTHENTICATION, AND ENCRYPTION");
  console.log("================================================================================\n");

  let serverProcess = null;

  try {
    // 1. Connect to DB to manage test data state
    await connectDB();
    console.log("✔ Connected to MongoDB successfully.");

    // Clean up previous test users and audit logs
    const testEmails = ["sec_doctor@example.com", "sec_patient@example.com"];
    const existingUsers = await User.find({ email: { $in: testEmails } });
    const userIds = existingUsers.map((u) => u._id);
    
    await Patient.deleteMany({ user: { $in: userIds } });
    await Doctor.deleteMany({ user: { $in: userIds } });
    await User.deleteMany({ _id: { $in: userIds } });
    await AuditLog.deleteMany({ userId: { $in: userIds } });
    console.log("✔ Cleanup complete (Removed old test data).");

    // 2. Start Express Server as a child process on port 5999
    console.log("Starting server process...");
    serverProcess = await new Promise((resolve, reject) => {
      const proc = spawn("node", ["src/server.js"], {
        env: { ...process.env, PORT: String(PORT) },
      });

      let hasStarted = false;

      proc.stdout.on("data", (data) => {
        const text = data.toString();
        if (text.includes("Server running on port 5999") || text.includes("MongoDB Connected")) {
          if (!hasStarted) {
            hasStarted = true;
            console.log("✔ Server spawned and listening on port 5999.");
            setTimeout(() => resolve(proc), 1000); // Wait 1s to stabilize
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

    // --- TEST AREA 1: AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC) ---
    console.log("\n--- [Test Area 1] Verification of Authentication & RBAC ---");

    // Test 1.1: Request without token
    const noTokenRes = await apiRequest("GET", "/api/auth/me");
    console.log(`[CHECK] GET /api/auth/me (No Token): Status = ${noTokenRes.statusCode} (Expected: 401)`);
    if (noTokenRes.statusCode !== 401) throw new Error("Authentication failed: allowed request without token");

    // Test 1.2: Request with invalid token
    const invalidTokenRes = await apiRequest("GET", "/api/auth/me", { Authorization: "Bearer invalid_token_123" });
    console.log(`[CHECK] GET /api/auth/me (Invalid Token): Status = ${invalidTokenRes.statusCode} (Expected: 401)`);
    if (invalidTokenRes.statusCode !== 401) throw new Error("Authentication failed: allowed request with invalid token");

    // --- TEST AREA 2: AUDIT LOGGING ON USER REGISTRATION ---
    console.log("\n--- [Test Area 2] Verification of User Registration & Audit Logging ---");

    // Test 2.1: Register a Doctor
    const doctorData = {
      name: "Dr. Audit Expert",
      email: "sec_doctor@example.com",
      password: "password123",
      role: "Doctor",
      specialization: "Cybersecurity",
      licenseNumber: "DOC-SEC-777",
    };
    const regDocRes = await apiRequest("POST", "/api/auth/register", {}, doctorData);
    console.log(`[CHECK] Register Doctor API: Status = ${regDocRes.statusCode} (Expected: 201)`);
    if (regDocRes.statusCode !== 201) throw new Error("Doctor registration failed");

    // Extract Doctor Token & User ID
    const doctorToken = regDocRes.body.token;
    const doctorUserId = regDocRes.body.user.id;

    // Test 2.2: Verify Audit Log for Doctor Registration
    const docRegLog = await waitForAuditLog({ performedAction: "User Registration" });
    if (!docRegLog) throw new Error("Audit Log: Entry for Doctor Registration not found in database");
    console.log(`[CHECK] Doctor Registration Audit Log:
    - Action: "${docRegLog.performedAction}" (Expected: "User Registration")
    - Endpoint: "${docRegLog.apiEndpoint}" (Expected: "/api/auth/register")
    - User ID in Log: ${docRegLog.userId} (Expected Match: ${doctorUserId})
    - IP Address: "${docRegLog.ipAddress}"`);

    if (docRegLog.userId.toString() !== doctorUserId) {
      throw new Error("Audit Log: Logged userId does not match registered Doctor userId");
    }

    // Test 2.3: Register a Patient (Captures PHI)
    const patientData = {
      name: "Patient Secure",
      email: "sec_patient@example.com",
      password: "password123",
      role: "Patient",
      phone: "+1234567890",
      address: "123 Cryptography Lane",
      dateOfBirth: "1988-08-08",
      emergencyContact: "+9876543210",
      allergies: ["NSAIDs", "Lactose"],
      medicalHistory: ["Appendectomy"],
    };
    const regPatientRes = await apiRequest("POST", "/api/auth/register", {}, patientData);
    console.log(`[CHECK] Register Patient API: Status = ${regPatientRes.statusCode} (Expected: 201)`);
    if (regPatientRes.statusCode !== 201) throw new Error("Patient registration failed");

    const patientToken = regPatientRes.body.token;
    const patientUserId = regPatientRes.body.user.id;

    // Test 2.4: Verify Audit Log for Patient Registration
    const patientRegLog = await waitForAuditLog({ performedAction: "User Registration", userId: patientUserId });
    if (!patientRegLog) throw new Error("Audit Log: Entry for Patient Registration not found");
    console.log(`[CHECK] Patient Registration Audit Log: Action = "${patientRegLog.performedAction}", User ID = ${patientRegLog.userId}`);

    // --- TEST AREA 3: DATABASE ENCRYPTION VS API DECRYPTION (PHI) ---
    console.log("\n--- [Test Area 3] Verification of Data Encryption (PHI) ---");

    // Test 3.1: Check MongoDB directly (must be ENCRYPTED)
    const rawPatientDoc = await mongoose.connection.db.collection("patients").findOne({ user: new mongoose.Types.ObjectId(patientUserId) });
    if (!rawPatientDoc) throw new Error("Patient document not found in raw MongoDB query");

    const isPhoneEncrypted = rawPatientDoc.phone.split(":").length === 3;
    const isAddressEncrypted = rawPatientDoc.address.split(":").length === 3;
    const isDOBEncrypted = rawPatientDoc.dateOfBirth.split(":").length === 3;

    console.log(`[CHECK] Stored Patient PHI Fields (Raw DB):
    - Raw Phone: "${rawPatientDoc.phone}" | Encrypted (3 parts)? ${isPhoneEncrypted} (Expected: true)
    - Raw Address: "${rawPatientDoc.address}" | Encrypted (3 parts)? ${isAddressEncrypted} (Expected: true)
    - Raw DOB: "${rawPatientDoc.dateOfBirth}" | Encrypted (3 parts)? ${isDOBEncrypted} (Expected: true)`);

    if (!isPhoneEncrypted || !isAddressEncrypted || !isDOBEncrypted) {
      throw new Error("PHI Encryption: Sensitive patient fields are stored in plain text in database!");
    }

    // Test 3.2: Query via API using Patient Token (must be DECRYPTED)
    const patientProfileRes = await apiRequest("GET", "/api/patients/me", { Authorization: `Bearer ${patientToken}` });
    const apiPatient = patientProfileRes.body.patient;
    
    console.log(`[CHECK] Retrieved Patient Profile (API Response):
    - Decrypted Phone: "${apiPatient.phone}" (Expected: "${patientData.phone}")
    - Decrypted Address: "${apiPatient.address}" (Expected: "${patientData.address}")
    - Decrypted DOB: "${apiPatient.dateOfBirth}" (Expected: "${patientData.dateOfBirth}")`);

    if (apiPatient.phone !== patientData.phone || apiPatient.address !== patientData.address || apiPatient.dateOfBirth !== patientData.dateOfBirth) {
      throw new Error("PHI Decryption: API returned incorrect/undecrypted PHI values");
    }

    // Test 3.3: Verify audit log for Patient profile access
    const patientProfileLog = await waitForAuditLog({ performedAction: "Retrieve Own Patient Profile", userId: patientUserId });
    if (!patientProfileLog) throw new Error("Audit Log: Profile retrieval log entry not found");
    console.log(`[CHECK] Profile Access Audit Log: Action = "${patientProfileLog.performedAction}" (Expected: "Retrieve Own Patient Profile")`);

    // --- TEST AREA 4: DOCTOR ACTIONS, RBAC & MEDICAL RECORD AUDITING ---
    console.log("\n--- [Test Area 4] Verification of Doctor Actions & RBAC ---");

    // Test 4.1: Doctor login
    const loginRes = await apiRequest("POST", "/api/auth/login", {}, { email: doctorData.email, password: doctorData.password });
    console.log(`[CHECK] Doctor Login API: Status = ${loginRes.statusCode} (Expected: 200)`);
    
    const loginLog = await waitForAuditLog({ performedAction: "User Login", userId: doctorUserId });
    if (!loginLog) throw new Error("Audit Log: Login log not found");
    console.log(`[CHECK] Login Audit Log: Action = "${loginLog.performedAction}", User ID = ${loginLog.userId}`);

    // Test 4.2: Unauthorized role tries to hit doctor protected route
    const doctorRoutePatientTokenRes = await apiRequest("GET", "/api/protected/doctor", { Authorization: `Bearer ${patientToken}` });
    console.log(`[CHECK] Patient accessing /api/protected/doctor: Status = ${doctorRoutePatientTokenRes.statusCode} (Expected: 403)`);
    if (doctorRoutePatientTokenRes.statusCode !== 403) throw new Error("RBAC: Allowed Patient to access Doctor endpoint");

    // Test 4.3: Doctor creates a MedicalRecord and Prescription
    const patientProfileId = apiPatient._id;
    const recordPayload = {
      patientId: patientProfileId,
      diagnosis: "Secure Code Deficiency",
      symptoms: ["unlogged requests", "plaintext storage"],
      notes: "Prescribing immediately: Audit logs & AES encryption.",
      prescription: {
        medicines: [
          {
            name: "AuditLog Forte",
            dosage: "1 dose daily",
            frequency: "Continuous",
            duration: "Lifetime",
          },
        ],
        instructions: "Take with developer documentation.",
      },
    };

    const createRecordRes = await apiRequest("POST", "/api/records", { Authorization: `Bearer ${doctorToken}` }, recordPayload);
    console.log(`[CHECK] Create Medical Record API: Status = ${createRecordRes.statusCode} (Expected: 201)`);
    if (createRecordRes.statusCode !== 201) throw new Error("Create medical record API request failed");

    const createdRecordId = createRecordRes.body.medicalRecord._id;
    const createdPrescriptionId = createRecordRes.body.prescription._id;

    // Test 4.4: Verify Audit Log for Record Creation
    const recordCreateLog = await waitForAuditLog({ performedAction: "Create Medical Record and Prescription", userId: doctorUserId });
    if (!recordCreateLog) throw new Error("Audit Log: Record creation log entry not found");
    console.log(`[CHECK] Record Creation Audit Log: Action = "${recordCreateLog.performedAction}" (Expected: "Create Medical Record and Prescription")`);

    // Test 4.5: Verify record encryption in DB (Raw check)
    const rawRecordDoc = await mongoose.connection.db.collection("medicalrecords").findOne({ _id: new mongoose.Types.ObjectId(createdRecordId) });
    const rawPrescriptionDoc = await mongoose.connection.db.collection("prescriptions").findOne({ _id: new mongoose.Types.ObjectId(createdPrescriptionId) });

    const isDiagnosisEncrypted = rawRecordDoc.diagnosis.split(":").length === 3;
    const isPrescriptionInstEncrypted = rawPrescriptionDoc.instructions.split(":").length === 3;
    const isMedNameEncrypted = rawPrescriptionDoc.medicines[0].name.split(":").length === 3;

    console.log(`[CHECK] Raw Stored Medical Record & Prescription PHI (DB):
    - Raw Diagnosis: "${rawRecordDoc.diagnosis}" | Encrypted? ${isDiagnosisEncrypted}
    - Raw Instructions: "${rawPrescriptionDoc.instructions}" | Encrypted? ${isPrescriptionInstEncrypted}
    - Raw Medicine Name: "${rawPrescriptionDoc.medicines[0].name}" | Encrypted? ${isMedNameEncrypted}`);

    if (!isDiagnosisEncrypted || !isPrescriptionInstEncrypted || !isMedNameEncrypted) {
      throw new Error("PHI Encryption: Medical record or prescription fields were not encrypted in DB!");
    }

    // Test 4.6: Verify record decryption via API using Patient Token (Retrieve own records)
    const getRecordsRes = await apiRequest("GET", `/api/records/patient/${patientProfileId}`, { Authorization: `Bearer ${patientToken}` });
    console.log(`[CHECK] Patient fetching own medical records: Status = ${getRecordsRes.statusCode} (Expected: 200)`);
    if (getRecordsRes.statusCode !== 200) throw new Error("Patient could not retrieve own records");

    const retrievedRecord = getRecordsRes.body.records[0];
    console.log(`[CHECK] Retrieved Medical Record (API Response):
    - Decrypted Diagnosis: "${retrievedRecord.diagnosis}" (Expected: "${recordPayload.diagnosis}")
    - Decrypted Medicine Name: "${retrievedRecord.prescription.medicines[0].name}" (Expected: "${recordPayload.prescription.medicines[0].name}")`);

    if (retrievedRecord.diagnosis !== recordPayload.diagnosis || retrievedRecord.prescription.medicines[0].name !== recordPayload.prescription.medicines[0].name) {
      throw new Error("PHI Decryption: API returned incorrect/undecrypted medical record or prescription values");
    }

    // Clean up test data at the end of successful run
    await Prescription.findByIdAndDelete(createdPrescriptionId);
    await MedicalRecord.findByIdAndDelete(createdRecordId);
    await Patient.deleteMany({ user: { $in: userIds } });
    await Doctor.deleteMany({ user: { $in: userIds } });
    await User.deleteMany({ _id: { $in: userIds } });
    await AuditLog.deleteMany({ userId: { $in: userIds } });
    console.log("\n✔ Cleanup post-test data complete.");

    console.log("\n================================================================================");
    console.log("🎉 ALL TESTS PASSED: Logging, Authentication, and Encryption behaviors verified!");
    console.log("================================================================================\n");

  } catch (error) {
    console.error("\n❌ TEST SUITE FAILED:", error);
    process.exitCode = 1;
  } finally {
    // Make sure to kill the server process
    if (serverProcess) {
      console.log("Stopping server process...");
      serverProcess.kill();
    }
    
    // Close database connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log("Disconnected from MongoDB.");
    }
    process.exit();
  }
};

runSecuritySuite();
