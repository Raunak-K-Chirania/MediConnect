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
const Appointment = require("./models/Appointment");

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

const runTests = async () => {
  console.log("================================================================================");
  console.log("🏥 STARTING INTEGRATION TEST SUITE: DIGITAL PRESCRIPTIONS");
  console.log("================================================================================\n");

  let serverProcess = null;

  try {
    // 1. Connect to DB to manage test data state
    await connectDB();
    console.log("✔ Connected to MongoDB successfully.");

    // Clean up previous test users and audit logs
    const testEmails = [
      "test_rx_alice@example.com",
      "test_rx_bob@example.com",
      "test_rx_john@example.com",
      "test_rx_admin@example.com"
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
        if (text.includes(`Server running on port ${PORT}`) || text.includes("MongoDB Connected")) {
          if (!hasStarted) {
            hasStarted = true;
            console.log(`✔ Server spawned and listening on port ${PORT}.`);
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

    // 3. Register Users
    console.log("\nRegistering test users...");
    
    // Alice (Doctor)
    const docAliceRes = await apiRequest("POST", "/api/auth/register", {}, {
      name: "Dr. Alice Smith",
      email: "test_rx_alice@example.com",
      password: "password123",
      role: "Doctor",
      specialization: "Cardiology",
      licenseNumber: "LIC-ALICE-RX",
      hospital: "MediConnect Heart Center",
      qualification: "MD, FACC",
    });
    if (docAliceRes.statusCode !== 201) throw new Error("Doctor Alice registration failed");
    const docAliceToken = docAliceRes.body.token;
    const docAliceUserId = docAliceRes.body.user.id;
    const docAliceProfile = await Doctor.findOne({ user: docAliceUserId });

    // Bob (Doctor - Unassigned)
    const docBobRes = await apiRequest("POST", "/api/auth/register", {}, {
      name: "Dr. Bob Jones",
      email: "test_rx_bob@example.com",
      password: "password123",
      role: "Doctor",
      specialization: "Pediatrics",
      licenseNumber: "LIC-BOB-RX",
      hospital: "MediConnect Kids Clinic",
      qualification: "MD, FAAP",
    });
    if (docBobRes.statusCode !== 201) throw new Error("Doctor Bob registration failed");
    const docBobToken = docBobRes.body.token;
    const docBobUserId = docBobRes.body.user.id;
    const docBobProfile = await Doctor.findOne({ user: docBobUserId });

    // John (Patient)
    const patientJohnRes = await apiRequest("POST", "/api/auth/register", {}, {
      name: "John Doe",
      email: "test_rx_john@example.com",
      password: "password123",
      role: "Patient",
      phone: "+15555555555",
      address: "456 Oak Street",
      dateOfBirth: "1990-01-01",
      emergencyContact: "+19999999999",
      allergies: ["Shellfish"],
      medicalHistory: ["Asthma"],
      gender: "Male",
      bloodGroup: "O+",
    });
    if (patientJohnRes.statusCode !== 201) throw new Error("Patient John registration failed");
    const patientJohnToken = patientJohnRes.body.token;
    const patientJohnUserId = patientJohnRes.body.user.id;
    const patientJohnProfile = await Patient.findOne({ user: patientJohnUserId });

    // Admin
    const adminRes = await apiRequest("POST", "/api/auth/register", {}, {
      name: "Admin User",
      email: "test_rx_admin@example.com",
      password: "password123",
      role: "Admin",
    });
    if (adminRes.statusCode !== 201) throw new Error("Admin registration failed");
    const adminToken = adminRes.body.token;
    const adminUserId = adminRes.body.user.id;

    console.log("✔ Test users created and profiles fetched.");

    // 4. Create an Appointment between Patient John and Doctor Alice (Enabling access)
    const appointment = new Appointment({
      patient: patientJohnProfile._id,
      doctor: docAliceProfile._id,
      appointmentDate: new Date(),
      status: "Scheduled",
    });
    await appointment.save();
    console.log("✔ Appointment created successfully (assigned Doctor Alice to Patient John).");

    // Create a medical record for reference
    const recordPayload = {
      patientId: patientJohnProfile._id.toString(),
      diagnosis: "Hypertension",
      symptoms: ["headache", "dizziness"],
      treatmentPlan: "Prescribe lifestyle changes and Lisinopril",
      medications: ["Lisinopril 10mg"],
      allergies: ["None"],
      notes: "Follow up in 1 month.",
      visitDate: new Date().toISOString(),
    };
    const createRecRes = await apiRequest("POST", "/api/records", { Authorization: `Bearer ${docAliceToken}` }, recordPayload);
    if (createRecRes.statusCode !== 201) throw new Error("Medical record creation failed");
    const recordId = createRecRes.body.medicalRecord._id;
    console.log(`✔ Medical record created for reference. ID: ${recordId}`);

    // --- TEST AREA 1: CREATE PRESCRIPTION ---
    console.log("\n--- [Test Area 1] Prescription Creation & Validation ---");

    // Test 1.1: Success Creation (Assigned Doctor)
    const prescriptionPayload = {
      patientId: patientJohnProfile._id.toString(),
      medicalRecord: recordId.toString(),
      medicines: [
        {
          name: "Lisinopril",
          dosage: "10mg",
          frequency: "Once daily in the morning",
          duration: "30 days"
        },
        {
          name: "Amlodipine",
          dosage: "5mg",
          frequency: "Once daily in the evening",
          duration: "30 days"
        }
      ],
      instructions: "Take with plenty of water. Monitor blood pressure.",
      followUpDate: "2026-08-09"
    };

    const createRxRes1 = await apiRequest("POST", "/api/prescriptions", { Authorization: `Bearer ${docAliceToken}` }, prescriptionPayload);
    console.log(`[CHECK] POST /api/prescriptions (Doctor Alice - Assigned): Status = ${createRxRes1.statusCode} (Expected: 201)`);
    if (createRxRes1.statusCode !== 201) throw new Error("Prescription creation failed");
    const prescriptionId = createRxRes1.body.data._id;
    console.log(`✔ Prescription created successfully. ID: ${prescriptionId}`);

    // Verify DB encryption / decryption
    const rxInDb = await Prescription.findById(prescriptionId);
    if (rxInDb.instructions !== "Take with plenty of water. Monitor blood pressure.") {
      throw new Error("Prescription data decryption check failed");
    }
    console.log("✔ Prescription encryption & decryption verified.");

    // Verify Audit Log
    const createAudit = await waitForAuditLog({ action: "PRESCRIPTION_CREATED", userId: docAliceUserId });
    if (!createAudit) throw new Error("Audit Log: Create log entry not found in database");
    console.log(`[CHECK] Prescription Create Audit Log: Action = "${createAudit.action}" (Expected: "PRESCRIPTION_CREATED")`);

    // Test 1.2: Validation Check (Empty Medicines)
    const invalidPayload1 = { ...prescriptionPayload, medicines: [] };
    const createRxFail1 = await apiRequest("POST", "/api/prescriptions", { Authorization: `Bearer ${docAliceToken}` }, invalidPayload1);
    console.log(`[CHECK] POST /api/prescriptions (Empty Medicines): Status = ${createRxFail1.statusCode} (Expected: 400/500 Zod error)`);
    if (createRxFail1.statusCode !== 400 && createRxFail1.statusCode !== 500) {
      throw new Error("Validation check failed: Empty medicines allowed.");
    }

    // Test 1.3: Validation Check (Invalid Follow-up Date)
    const invalidPayload2 = { ...prescriptionPayload, followUpDate: "not-a-date" };
    const createRxFail2 = await apiRequest("POST", "/api/prescriptions", { Authorization: `Bearer ${docAliceToken}` }, invalidPayload2);
    console.log(`[CHECK] POST /api/prescriptions (Invalid Date): Status = ${createRxFail2.statusCode} (Expected: 400/500 Zod error)`);
    if (createRxFail2.statusCode !== 400 && createRxFail2.statusCode !== 500) {
      throw new Error("Validation check failed: Invalid followUpDate format allowed.");
    }

    // Test 1.4: Validation Check (Missing both patientId and medicalRecord)
    const invalidPayload3 = { medicines: prescriptionPayload.medicines };
    const createRxFail3 = await apiRequest("POST", "/api/prescriptions", { Authorization: `Bearer ${docAliceToken}` }, invalidPayload3);
    console.log(`[CHECK] POST /api/prescriptions (Missing references): Status = ${createRxFail3.statusCode} (Expected: 400/500 Zod error)`);
    if (createRxFail3.statusCode !== 400 && createRxFail3.statusCode !== 500) {
      throw new Error("Validation check failed: Missing both patientId and medicalRecord allowed.");
    }

    // Test 1.5: Auto-populate patientId and doctorId from medicalRecord
    const autoPopulatePayload = {
      medicalRecord: recordId.toString(),
      medicines: [
        {
          name: "Metformin",
          dosage: "500mg",
          frequency: "Twice daily with meals",
          duration: "15 days"
        }
      ],
      instructions: "Check blood sugar levels."
    };
    const createRxRes2 = await apiRequest("POST", "/api/prescriptions", { Authorization: `Bearer ${docAliceToken}` }, autoPopulatePayload);
    console.log(`[CHECK] POST /api/prescriptions (Auto-populate via medicalRecord): Status = ${createRxRes2.statusCode} (Expected: 201)`);
    if (createRxRes2.statusCode !== 201) throw new Error("Auto-populate prescription creation failed");
    const autoPopulatedRxId = createRxRes2.body.data._id;
    const autoPopulatedRx = await Prescription.findById(autoPopulatedRxId);
    console.log(`[CHECK] Resolved fields:
    - patientId: "${autoPopulatedRx.patientId.toString()}" (Expected: "${patientJohnProfile._id.toString()}")
    - doctorId: "${autoPopulatedRx.doctorId.toString()}" (Expected: "${docAliceProfile._id.toString()}")`);
    if (autoPopulatedRx.patientId.toString() !== patientJohnProfile._id.toString() ||
        autoPopulatedRx.doctorId.toString() !== docAliceProfile._id.toString()) {
      throw new Error("Auto-populate hook failed to resolve doctorId/patientId from medicalRecord");
    }
    console.log("✔ Auto-populate pre-validate hook verified successfully.");

    // Test 1.6: Security check - Unassigned Doctor Bob attempts to create prescription
    const bobPayload = { ...prescriptionPayload };
    const createRxFail4 = await apiRequest("POST", "/api/prescriptions", { Authorization: `Bearer ${docBobToken}` }, bobPayload);
    console.log(`[CHECK] POST /api/prescriptions (Doctor Bob - Unassigned): Status = ${createRxFail4.statusCode} (Expected: 403)`);
    if (createRxFail4.statusCode !== 403) throw new Error("Security check failed: Unassigned doctor allowed to create prescription.");

    // --- TEST AREA 2: GET PRESCRIPTION DETAILS ---
    console.log("\n--- [Test Area 2] Prescription Retrieval & Access Controls ---");

    // Test 2.1: Doctor Alice retrieves prescription (Should succeed 200)
    const getRxRes1 = await apiRequest("GET", `/api/prescriptions/${prescriptionId}`, { Authorization: `Bearer ${docAliceToken}` });
    console.log(`[CHECK] GET /api/prescriptions/:id (Doctor Alice - Assigned): Status = ${getRxRes1.statusCode} (Expected: 200)`);
    if (getRxRes1.statusCode !== 200) throw new Error("Retrieval failed for assigned doctor");

    // Verify populated fields
    console.log(`[CHECK] Populated fields:
    - Doctor Name: "${getRxRes1.body.data.doctorId?.user?.name}" (Expected: "Dr. Alice Smith")
    - Patient Name: "${getRxRes1.body.data.patientId?.user?.name}" (Expected: "John Doe")
    - Diagnosis: "${getRxRes1.body.data.medicalRecord?.diagnosis}" (Expected: "Hypertension")`);
    if (getRxRes1.body.data.doctorId?.user?.name !== "Dr. Alice Smith" ||
        getRxRes1.body.data.patientId?.user?.name !== "John Doe" ||
        getRxRes1.body.data.medicalRecord?.diagnosis !== "Hypertension") {
      throw new Error("Populate checks failed on prescription details");
    }

    // Verify Audit Log
    const viewAudit = await waitForAuditLog({ action: "PRESCRIPTION_VIEWED", userId: docAliceUserId });
    if (!viewAudit) throw new Error("Audit Log: View log entry not found in database");
    console.log(`[CHECK] Prescription View Audit Log: Action = "${viewAudit.action}" (Expected: "PRESCRIPTION_VIEWED")`);

    // Test 2.2: Patient John retrieves own prescription (Should succeed 200)
    const getRxRes2 = await apiRequest("GET", `/api/prescriptions/${prescriptionId}`, { Authorization: `Bearer ${patientJohnToken}` });
    console.log(`[CHECK] GET /api/prescriptions/:id (Patient John - Own): Status = ${getRxRes2.statusCode} (Expected: 200)`);
    if (getRxRes2.statusCode !== 200) throw new Error("Retrieval failed for patient owner");

    // Test 2.3: Admin retrieves prescription (Should succeed 200)
    const getRxRes3 = await apiRequest("GET", `/api/prescriptions/${prescriptionId}`, { Authorization: `Bearer ${adminToken}` });
    console.log(`[CHECK] GET /api/prescriptions/:id (Admin): Status = ${getRxRes3.statusCode} (Expected: 200)`);
    if (getRxRes3.statusCode !== 200) throw new Error("Retrieval failed for Admin");

    // Test 2.4: Doctor Bob retrieves prescription (Should fail 403 - Unassigned)
    const getRxFail1 = await apiRequest("GET", `/api/prescriptions/${prescriptionId}`, { Authorization: `Bearer ${docBobToken}` });
    console.log(`[CHECK] GET /api/prescriptions/:id (Doctor Bob - Unassigned): Status = ${getRxFail1.statusCode} (Expected: 403)`);
    if (getRxFail1.statusCode !== 403) throw new Error("Security check failed: Unassigned doctor allowed to read prescription.");

    // --- TEST AREA 3: GET PATIENT PRESCRIPTIONS ---
    console.log("\n--- [Test Area 3] Retrieve Patient Prescriptions List ---");

    // Test 3.1: Doctor Alice retrieves patient prescriptions
    const listRxRes1 = await apiRequest("GET", `/api/prescriptions/patient/${patientJohnProfile._id}`, { Authorization: `Bearer ${docAliceToken}` });
    console.log(`[CHECK] GET /api/prescriptions/patient/:patientId (Doctor Alice): Status = ${listRxRes1.statusCode} (Expected: 200)`);
    if (listRxRes1.statusCode !== 200) throw new Error("Retrieve patient prescriptions failed for assigned doctor");
    if (!Array.isArray(listRxRes1.body.data) || listRxRes1.body.data.length < 2) {
      throw new Error(`Expected at least 2 prescriptions in list, got ${listRxRes1.body.data?.length}`);
    }

    // Verify Audit Log
    const listAudit = await waitForAuditLog({ action: "PRESCRIPTION_LIST_VIEWED", userId: docAliceUserId });
    if (!listAudit) throw new Error("Audit Log: List view log entry not found");
    console.log(`[CHECK] Prescription List View Audit Log: Action = "${listAudit.action}" (Expected: "PRESCRIPTION_LIST_VIEWED")`);

    // Test 3.2: Patient John retrieves own list
    const listRxRes2 = await apiRequest("GET", `/api/prescriptions/patient/${patientJohnProfile._id}`, { Authorization: `Bearer ${patientJohnToken}` });
    console.log(`[CHECK] GET /api/prescriptions/patient/:patientId (Patient John): Status = ${listRxRes2.statusCode} (Expected: 200)`);
    if (listRxRes2.statusCode !== 200) throw new Error("Retrieve patient prescriptions failed for own patient");

    // Test 3.3: Doctor Bob retrieves patient list (Should fail 403)
    const listRxFail1 = await apiRequest("GET", `/api/prescriptions/patient/${patientJohnProfile._id}`, { Authorization: `Bearer ${docBobToken}` });
    console.log(`[CHECK] GET /api/prescriptions/patient/:patientId (Doctor Bob - Unassigned): Status = ${listRxFail1.statusCode} (Expected: 403)`);
    if (listRxFail1.statusCode !== 403) throw new Error("Security check failed: Unassigned doctor allowed to retrieve patient prescriptions.");

    // --- TEST AREA 4: PDF GENERATION ---
    console.log("\n--- [Test Area 4] Prescription PDF Generation & Streaming ---");

    // Test 4.1: Download PDF (Patient John)
    const pdfRes1 = await apiRequest("GET", `/api/prescriptions/${prescriptionId}/pdf`, { Authorization: `Bearer ${patientJohnToken}` });
    console.log(`[CHECK] GET /api/prescriptions/:id/pdf (Patient John): Status = ${pdfRes1.statusCode} (Expected: 200)`);
    console.log(`[CHECK] PDF Headers:
    - Content-Type: "${pdfRes1.headers["content-type"]}" (Expected: "application/pdf")
    - Content-Disposition: "${pdfRes1.headers["content-disposition"]}" (Expected to contain "attachment; filename="prescription-${prescriptionId}.pdf")`);

    if (pdfRes1.statusCode !== 200) throw new Error("PDF generation request failed");
    if (pdfRes1.headers["content-type"] !== "application/pdf") {
      throw new Error(`Expected PDF Content-Type, got "${pdfRes1.headers["content-type"]}"`);
    }
    if (!pdfRes1.headers["content-disposition"] || !pdfRes1.headers["content-disposition"].includes("attachment; filename=")) {
      throw new Error(`Invalid Content-Disposition: "${pdfRes1.headers["content-disposition"]}"`);
    }

    // Verify PDF Audit Log
    const pdfAudit = await waitForAuditLog({ action: "PRESCRIPTION_PDF_DOWNLOADED", userId: patientJohnUserId });
    if (!pdfAudit) throw new Error("Audit Log: PDF download log entry not found");
    console.log(`[CHECK] Prescription PDF Download Audit Log: Action = "${pdfAudit.action}" (Expected: "PRESCRIPTION_PDF_DOWNLOADED")`);

    // Clean up created records in database
    console.log("\nCleaning up test prescriptions and database state...");
    await Prescription.deleteMany({ patientId: patientJohnProfile._id });
    await MedicalRecord.findByIdAndDelete(recordId);
    await Appointment.findByIdAndDelete(appointment._id);
    await Patient.deleteMany({ user: { $in: userIds } });
    await Doctor.deleteMany({ user: { $in: userIds } });
    await User.deleteMany({ _id: { $in: userIds } });
    await AuditLog.deleteMany({ userId: { $in: userIds } });
    console.log("✔ Cleanup complete.");

    console.log("\n================================================================================");
    console.log("🎉 ALL TESTS COMPLETED SUCCESSFULLY!");
    console.log("================================================================================");
    
    // Exit server process
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
