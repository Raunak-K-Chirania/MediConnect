const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const http = require("http");
const { spawn } = require("child_process");
const jwt = require("jsonwebtoken");
const connectDB = require("./config/db");

// Models to verify and manipulate data
const User = require("./models/User");
const Patient = require("./models/Patient");
const Doctor = require("./models/Doctor");
const AuditLog = require("./models/AuditLog");
const Appointment = require("./models/Appointment");
const DoctorAvailability = require("./models/DoctorAvailability");

const PORT = 5998;
const BASE_URL = `http://localhost:${PORT}`;

// Helper to make promise-based HTTP requests
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
  console.log("🔒 STARTING TELEHEALTH SECURITY & ROOM TOKEN INTEGRATION TEST SUITE");
  console.log("================================================================================\n");

  let serverProcess = null;

  try {
    // 1. Connect to DB
    await connectDB();
    console.log("✔ Connected to MongoDB successfully.");

    // Cleanup old test data
    const testEmails = [
      "test_tele_doc@example.com",
      "test_tele_patient_a@example.com",
      "test_tele_patient_b@example.com",
      "test_tele_admin@example.com"
    ];
    const existingUsers = await User.find({ email: { $in: testEmails } });
    const userIds = existingUsers.map((u) => u._id);

    await Appointment.deleteMany({
      $or: [
        { patientId: { $in: userIds } },
        { doctorId: { $in: userIds } }
      ]
    });
    await DoctorAvailability.deleteMany({ doctorId: { $in: userIds } });
    await Patient.deleteMany({ user: { $in: userIds } });
    await Doctor.deleteMany({ user: { $in: userIds } });
    await User.deleteMany({ _id: { $in: userIds } });
    await AuditLog.deleteMany({ userId: { $in: userIds } });
    console.log("✔ Cleanup complete.");

    // 2. Start Express Server
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

    // 3. Register Users
    console.log("\nRegistering test users...");

    // Doctor
    const docRes = await apiRequest("POST", "/api/auth/register", {}, {
      name: "Dr. Gregory House",
      email: "test_tele_doc@example.com",
      password: "password123",
      role: "Doctor",
      specialization: "Diagnostic Medicine",
      licenseNumber: "LIC-HOUSE-999",
    });
    if (docRes.statusCode !== 201) throw new Error("Doctor registration failed");
    const docToken = docRes.body.token;
    const docUserId = docRes.body.user.id;
    console.log(`✔ Registered Doctor User ID: ${docUserId}`);

    // Patient A
    const patientARes = await apiRequest("POST", "/api/auth/register", {}, {
      name: "John PatientA",
      email: "test_tele_patient_a@example.com",
      password: "password123",
      role: "Patient",
      phone: "+15551112222",
      address: "221B Baker St",
      dateOfBirth: "1985-05-15",
      emergencyContact: "+19991112222",
      allergies: [],
      medicalHistory: [],
    });
    if (patientARes.statusCode !== 201) throw new Error("Patient A registration failed");
    const patientAToken = patientARes.body.token;
    const patientAUserId = patientARes.body.user.id;
    console.log(`✔ Registered Patient A User ID: ${patientAUserId}`);

    // Patient B
    const patientBRes = await apiRequest("POST", "/api/auth/register", {}, {
      name: "Jane PatientB",
      email: "test_tele_patient_b@example.com",
      password: "password123",
      role: "Patient",
      phone: "+15552223333",
      address: "42 Wallaby Way",
      dateOfBirth: "1990-08-20",
      emergencyContact: "+19992223333",
      allergies: [],
      medicalHistory: [],
    });
    if (patientBRes.statusCode !== 201) throw new Error("Patient B registration failed");
    const patientBToken = patientBRes.body.token;
    const patientBUserId = patientBRes.body.user.id;
    console.log(`✔ Registered Patient B User ID: ${patientBUserId}`);

    // Admin
    const adminRes = await apiRequest("POST", "/api/auth/register", {}, {
      name: "Admin Sched",
      email: "test_tele_admin@example.com",
      password: "password123",
      role: "Admin",
    });
    if (adminRes.statusCode !== 201) throw new Error("Admin registration failed");
    const adminToken = adminRes.body.token;
    console.log(`✔ Registered Admin.`);

    // Set Doctor Availability
    const availabilityPayload = {
      doctorId: docUserId,
      workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      startHour: "00:00",
      endHour: "23:59",
      slotDuration: 30,
    };
    await apiRequest("POST", "/doctor-availability", { Authorization: `Bearer ${docToken}` }, availabilityPayload);
    console.log("✔ Configured doctor 24/7 availability for testing.");

    // --- TEST AREA 1: ACCESS BEFORE/AFTER SCHEDULED TIME ---
    console.log("\n--- [Test Area 1] Access Outside Scheduled Consultation Time ---");

    // Book an appointment for a future date (July 20th, 2026)
    const apptPayload = {
      patientId: patientAUserId,
      doctorId: docUserId,
      appointmentDate: "2026-07-20",
      startTime: "10:00",
      endTime: "10:30",
      appointmentType: "Online Video Consult",
      reasonForVisit: "Regular consultation",
    };
    const bookAppt = await apiRequest("POST", "/appointments", { Authorization: `Bearer ${patientAToken}` }, apptPayload);
    const apptId = bookAppt.body.data._id;
    
    // Approve the appointment
    await apiRequest("PATCH", `/appointments/${apptId}/approve`, { Authorization: `Bearer ${docToken}` });
    console.log(`✔ Created and approved appointment ID: ${apptId} for July 20th, 2026, 10:00-10:30`);

    // Request token for Patient A (currently outside scheduled time - July 20th)
    const outsideTimeRes = await apiRequest("GET", `/appointments/${apptId}/meeting-token`, { Authorization: `Bearer ${patientAToken}` });
    console.log(`[CHECK] GET /appointments/:id/meeting-token (Future time): Status = ${outsideTimeRes.statusCode} (Expected: 400)`);
    if (outsideTimeRes.statusCode !== 400) {
      throw new Error("Validation failure: Allowed room entry outside scheduled consultation time.");
    }
    console.log(`- Refusal message: "${outsideTimeRes.body.error}"`);

    // --- TEST AREA 2: ACCESS WITHIN VALID WINDOW ---
    console.log("\n--- [Test Area 2] Access Within Scheduled Consultation Time (With Buffers) ---");

    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    
    // Set appointment date to today
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    
    // Case A: Within active appointment time (start 5 mins ago, end 25 mins later)
    const startMins = now.getHours() * 60 + now.getMinutes() - 5;
    const endMins = startMins + 30;
    
    const formatMinutes = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
    const startTimeStr = formatMinutes(startMins);
    const endTimeStr = formatMinutes(endMins);

    // Update appointment in DB
    await Appointment.findByIdAndUpdate(apptId, {
      appointmentDate: new Date(todayStr),
      startTime: startTimeStr,
      endTime: endTimeStr,
    });
    console.log(`✔ Updated appointment to TODAY: ${todayStr} @ ${startTimeStr} - ${endTimeStr}`);

    // Request token for Patient A
    const patientAResToken = await apiRequest("GET", `/appointments/${apptId}/meeting-token`, { Authorization: `Bearer ${patientAToken}` });
    console.log(`[CHECK] GET /appointments/:id/meeting-token (Patient A - Owner): Status = ${patientAResToken.statusCode} (Expected: 200)`);
    if (patientAResToken.statusCode !== 200) {
      throw new Error("Validation failure: Denied Patient A access during scheduled consultation time.");
    }

    // Request token for Doctor
    const docResToken = await apiRequest("GET", `/appointments/${apptId}/meeting-token`, { Authorization: `Bearer ${docToken}` });
    console.log(`[CHECK] GET /appointments/:id/meeting-token (Doctor): Status = ${docResToken.statusCode} (Expected: 200)`);
    if (docResToken.statusCode !== 200) {
      throw new Error("Validation failure: Denied Doctor access during scheduled consultation time.");
    }

    // Request token for Admin
    const adminResToken = await apiRequest("GET", `/appointments/${apptId}/meeting-token`, { Authorization: `Bearer ${adminToken}` });
    console.log(`[CHECK] GET /appointments/:id/meeting-token (Admin): Status = ${adminResToken.statusCode} (Expected: 200)`);
    if (adminResToken.statusCode !== 200) {
      throw new Error("Validation failure: Denied Admin access during scheduled consultation time.");
    }

    // Verify token payload contents
    const token = patientAResToken.body.data.token;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
    console.log(`✔ Room token cryptographically verified. Payload contents:`);
    console.log(`  - roomId: ${decoded.roomId} (Matches: ${decoded.roomId === apptId})`);
    console.log(`  - userId: ${decoded.userId} (Matches: ${decoded.userId === patientAUserId})`);
    console.log(`  - role: ${decoded.role} (Matches: ${decoded.role === "Patient"})`);
    
    if (decoded.roomId !== apptId || decoded.userId !== patientAUserId || decoded.role !== "Patient") {
      throw new Error("Validation failure: Token payload values do not match user context.");
    }

    // --- TEST AREA 3: ROOM ENTRY RESTRICTIONS & UNAUTHORIZED entry ---
    console.log("\n--- [Test Area 3] Prevent Unauthorized Room Entry ---");

    // Request token for Patient B (unauthorized third-party)
    const patientBResToken = await apiRequest("GET", `/appointments/${apptId}/meeting-token`, { Authorization: `Bearer ${patientBToken}` });
    console.log(`[CHECK] GET /appointments/:id/meeting-token (Patient B - Stranger): Status = ${patientBResToken.statusCode} (Expected: 403)`);
    if (patientBResToken.statusCode !== 403) {
      throw new Error("Security breach: Allowed unauthorized Patient B to access consultation token.");
    }
    console.log(`- Refusal message: "${patientBResToken.body.error}"`);

    // --- TEST AREA 4: TIME BUFFERS ---
    console.log("\n--- [Test Area 4] Validation of Time Buffers ---");

    // Case 4.1: Within 10-minute early join window (e.g. 5 minutes before scheduled start)
    const earlyStartMins = now.getHours() * 60 + now.getMinutes() + 5;
    const earlyEndMins = earlyStartMins + 30;
    await Appointment.findByIdAndUpdate(apptId, {
      startTime: formatMinutes(earlyStartMins),
      endTime: formatMinutes(earlyEndMins),
    });
    const earlyRes = await apiRequest("GET", `/appointments/${apptId}/meeting-token`, { Authorization: `Bearer ${patientAToken}` });
    console.log(`[CHECK] Early Join Buffer (5 mins before start): Status = ${earlyRes.statusCode} (Expected: 200)`);
    if (earlyRes.statusCode !== 200) {
      throw new Error("Validation failure: Early buffer (10 mins) blocked entry.");
    }

    // Case 4.2: Outside 10-minute early join window (e.g. 15 minutes before scheduled start)
    const outsideEarlyStartMins = now.getHours() * 60 + now.getMinutes() + 15;
    const outsideEarlyEndMins = outsideEarlyStartMins + 30;
    await Appointment.findByIdAndUpdate(apptId, {
      startTime: formatMinutes(outsideEarlyStartMins),
      endTime: formatMinutes(outsideEarlyEndMins),
    });
    const outsideEarlyRes = await apiRequest("GET", `/appointments/${apptId}/meeting-token`, { Authorization: `Bearer ${patientAToken}` });
    console.log(`[CHECK] Outside Early Buffer (15 mins before start): Status = ${outsideEarlyRes.statusCode} (Expected: 400)`);
    if (outsideEarlyRes.statusCode !== 400) {
      throw new Error("Security breach: Allowed room entry before early join buffer (10 mins).");
    }

    // Case 4.3: Within 30-minute late exit window (e.g. 25 minutes after scheduled end)
    const lateStartMins = now.getHours() * 60 + now.getMinutes() - 55;
    const lateEndMins = now.getHours() * 60 + now.getMinutes() - 25; // Ended 25 mins ago
    await Appointment.findByIdAndUpdate(apptId, {
      startTime: formatMinutes(lateStartMins),
      endTime: formatMinutes(lateEndMins),
    });
    const lateResWithAuth = await apiRequest("GET", `/appointments/${apptId}/meeting-token`, { Authorization: `Bearer ${patientAToken}` });
    console.log(`[CHECK] Late Exit Buffer (25 mins after end): Status = ${lateResWithAuth.statusCode} (Expected: 200)`);
    if (lateResWithAuth.statusCode !== 200) {
      throw new Error("Validation failure: Late exit buffer (30 mins) blocked entry.");
    }

    // Case 4.4: Outside 30-minute late exit window (e.g. 35 minutes after scheduled end)
    const outsideLateStartMins = now.getHours() * 60 + now.getMinutes() - 65;
    const outsideLateEndMins = now.getHours() * 60 + now.getMinutes() - 35; // Ended 35 mins ago
    await Appointment.findByIdAndUpdate(apptId, {
      startTime: formatMinutes(outsideLateStartMins),
      endTime: formatMinutes(outsideLateEndMins),
    });
    const outsideLateRes = await apiRequest("GET", `/appointments/${apptId}/meeting-token`, { Authorization: `Bearer ${patientAToken}` });
    console.log(`[CHECK] Outside Late Buffer (35 mins after end): Status = ${outsideLateRes.statusCode} (Expected: 400)`);
    if (outsideLateRes.statusCode !== 400) {
      throw new Error("Security breach: Allowed room entry after late exit buffer (30 mins).");
    }

    // --- TEST CLEANUP ---
    console.log("\nCleaning up test records...");
    await Appointment.deleteMany({
      $or: [
        { patientId: { $in: userIds } },
        { doctorId: { $in: userIds } }
      ]
    });
    await DoctorAvailability.deleteMany({ doctorId: { $in: userIds } });
    await Patient.deleteMany({ user: { $in: userIds } });
    await Doctor.deleteMany({ user: { $in: userIds } });
    await User.deleteMany({ _id: { $in: userIds } });
    console.log("✔ Cleanup complete.");

    console.log("\n========================================================");
    console.log("🎉 ALL TESTS PASSED: TELEHEALTH TELECONFERENCE SECURITY IS FULLY ENFORCED!");
    console.log("========================================================");

  } catch (error) {
    console.error("\n❌ TELEHEALTH SECURITY TEST SUITE FAILED:", error);
    process.exitCode = 1;
  } finally {
    if (serverProcess) {
      console.log("Stopping server process...");
      serverProcess.kill();
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log("Disconnected from MongoDB.");
    }
    process.exit();
  }
};

runTests();
