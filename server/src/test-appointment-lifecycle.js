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
const AuditLog = require("./models/AuditLog");
const Appointment = require("./models/Appointment");
const DoctorAvailability = require("./models/DoctorAvailability");

const PORT = 5888;
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

// Helper to poll database for audit logs
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
  console.log("📅 STARTING APPOINTMENT LIFECYCLE & SCHEDULING INTEGRATION TEST SUITE");
  console.log("================================================================================\n");

  let serverProcess = null;

  try {
    // 1. Connect to DB
    await connectDB();
    console.log("✔ Connected to MongoDB successfully.");

    // Clean up test users, availabilities, appointments, and audit logs
    const testEmails = [
      "lifecycle_doc@example.com",
      "lifecycle_patient@example.com",
      "lifecycle_admin@example.com"
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
    console.log("✔ Cleanup complete (Removed old test data).");

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

    // Doctor
    const docRes = await apiRequest("POST", "/api/auth/register", {}, {
      name: "Dr. Gregory House",
      email: "lifecycle_doc@example.com",
      password: "password123",
      role: "Doctor",
      specialization: "Diagnostic Medicine",
      licenseNumber: "LIC-LIFE-777",
    });
    if (docRes.statusCode !== 201) throw new Error("Doctor registration failed");
    const docToken = docRes.body.token;
    const docUserId = docRes.body.user.id;
    console.log(`✔ Registered Doctor User ID: ${docUserId}`);

    // Patient
    const patientRes = await apiRequest("POST", "/api/auth/register", {}, {
      name: "John Lifecycle",
      email: "lifecycle_patient@example.com",
      password: "password123",
      role: "Patient",
      phone: "+15552223333",
      address: "221B Baker St",
      dateOfBirth: "1985-05-15",
      emergencyContact: "+19992223333",
      allergies: [],
      medicalHistory: [],
    });
    if (patientRes.statusCode !== 201) throw new Error("Patient registration failed");
    const patientToken = patientRes.body.token;
    const patientUserId = patientRes.body.user.id;
    console.log(`✔ Registered Patient User ID: ${patientUserId}`);

    // Admin
    const adminRes = await apiRequest("POST", "/api/auth/register", {}, {
      name: "Admin Lifecycle",
      email: "lifecycle_admin@example.com",
      password: "password123",
      role: "Admin",
    });
    if (adminRes.statusCode !== 201) throw new Error("Admin registration failed");
    const adminToken = adminRes.body.token;
    const adminUserId = adminRes.body.user.id;
    console.log(`✔ Registered Admin User ID: ${adminUserId}`);

    // Set availability config (Doctor House)
    const availabilityPayload = {
      doctorId: docUserId,
      workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      startHour: "09:00",
      endHour: "17:00",
      slotDuration: 30,
      breakSlots: [
        {
          start: "12:00",
          end: "13:00", // 1-hour lunch break
        },
      ],
    };

    const createAvailRes = await apiRequest("POST", "/doctor-availability", { Authorization: `Bearer ${docToken}` }, availabilityPayload);
    if (createAvailRes.statusCode !== 201) throw new Error("Availability creation failed");
    console.log("✔ Created doctor availability config.");

    // --- TEST 1: BOOKING AN APPOINTMENT (Requirement 2) ---
    console.log("\n--- [Test Case 1] Create Appointment Booking API ---");

    const bookingPayload = {
      patientId: patientUserId,
      doctorId: docUserId,
      appointmentDate: "2026-07-06", // A future Monday
      startTime: "09:00",
      endTime: "09:30",
      appointmentType: "Standard Consultation",
      reasonForVisit: "Chronic joint pain discussion.",
    };

    const bookRes = await apiRequest("POST", "/appointments", { Authorization: `Bearer ${patientToken}` }, bookingPayload);
    console.log(`[CHECK] POST /appointments: Status = ${bookRes.statusCode} (Expected: 201)`);
    if (bookRes.statusCode !== 201) throw new Error("Booking valid appointment failed");
    if (bookRes.body.status !== "pending") throw new Error("Initial status should be 'pending'");
    
    const appt1Id = bookRes.body.data._id;
    console.log(`✔ Appointment booked successfully. ID: ${appt1Id}`);

    // Audit Log verification
    const bookAudit = await waitForAuditLog({ action: "APPOINTMENT_CREATED", userId: patientUserId });
    if (!bookAudit) throw new Error("Audit log 'APPOINTMENT_CREATED' not found");
    console.log(`✔ Audit Log recorded action = "${bookAudit.action}", resourceId = "${bookAudit.resourceId}"`);

    // --- TEST 2: COLLISION DETECTION AND DUPLICATE BOOKINGS (Requirement 1) ---
    console.log("\n--- [Test Case 2] Overlap & Conflict Protection ---");
    
    // Attempt booking exact same time slot
    const duplicateRes = await apiRequest("POST", "/appointments", { Authorization: `Bearer ${patientToken}` }, bookingPayload);
    console.log(`[CHECK] POST /appointments (Duplicate slot): Status = ${duplicateRes.statusCode} (Expected: 400)`);
    if (duplicateRes.statusCode !== 400) throw new Error("Collision engine did not reject duplicate time slot");
    if (duplicateRes.body.message !== "Appointment slot unavailable") {
      throw new Error(`Expected 'Appointment slot unavailable', got: '${duplicateRes.body.message}'`);
    }
    console.log("✔ Overlap booking blocked successfully.");

    // --- TEST 3: APPOINTMENT APPROVAL WORKFLOW (Requirement 3 & 7) ---
    console.log("\n--- [Test Case 3] Appointment Approval Workflow ---");

    // Approve the pending appointment (Doctor)
    const approveRes = await apiRequest("PATCH", `/appointments/${appt1Id}/approve`, { Authorization: `Bearer ${docToken}` });
    console.log(`[CHECK] PATCH /appointments/:id/approve: Status = ${approveRes.statusCode} (Expected: 200)`);
    if (approveRes.statusCode !== 200) throw new Error("Approving appointment failed");
    if (approveRes.body.data.status !== "approved") throw new Error("Status was not updated to 'approved'");
    console.log("✔ Appointment status updated to 'approved'.");

    // Audit Log verification
    const approveAudit = await waitForAuditLog({ action: "APPOINTMENT_APPROVED", userId: docUserId });
    if (!approveAudit) throw new Error("Audit log 'APPOINTMENT_APPROVED' not found");
    console.log(`✔ Audit Log recorded action = "${approveAudit.action}"`);

    // Test transition rules: Approved -> Approved (no-op or invalid transition, let's make sure it blocks since it is not pending)
    const approveAgainRes = await apiRequest("PATCH", `/appointments/${appt1Id}/approve`, { Authorization: `Bearer ${docToken}` });
    console.log(`[CHECK] PATCH /appointments/:id/approve (Already Approved): Status = ${approveAgainRes.statusCode} (Expected: 400)`);
    if (approveAgainRes.statusCode !== 400) throw new Error("Allowed invalid transition: Approved -> Approved");
    console.log("✔ Blocked invalid transition (already approved).");

    // --- TEST 4: APPOINTMENT REJECTION WORKFLOW (Requirement 3 & 7) ---
    console.log("\n--- [Test Case 4] Appointment Rejection Workflow ---");

    // Book another appointment to reject
    const bookingPayload2 = {
      ...bookingPayload,
      startTime: "10:00",
      endTime: "10:30",
      reasonForVisit: "Second appointment to reject.",
    };
    const book2Res = await apiRequest("POST", "/appointments", { Authorization: `Bearer ${patientToken}` }, bookingPayload2);
    const appt2Id = book2Res.body.data._id;

    // Attempt rejection without reason
    const rejectNoReason = await apiRequest("PATCH", `/appointments/${appt2Id}/reject`, { Authorization: `Bearer ${docToken}` }, {});
    console.log(`[CHECK] PATCH /appointments/:id/reject (No Reason): Status = ${rejectNoReason.statusCode} (Expected: 400)`);
    if (rejectNoReason.statusCode !== 400) throw new Error("Allowed rejection without specifying reason");

    // Reject appointment (Doctor)
    const rejectRes = await apiRequest("PATCH", `/appointments/${appt2Id}/reject`, { Authorization: `Bearer ${docToken}` }, { reason: "Doctor unavailable" });
    console.log(`[CHECK] PATCH /appointments/:id/reject: Status = ${rejectRes.statusCode} (Expected: 200)`);
    if (rejectRes.statusCode !== 200) throw new Error("Rejecting appointment failed");
    if (rejectRes.body.data.status !== "rejected") throw new Error("Status was not updated to 'rejected'");
    if (rejectRes.body.data.notes !== "Doctor unavailable") throw new Error("Rejection reason not stored in notes");
    console.log("✔ Appointment successfully rejected and reason recorded.");

    // Audit Log verification
    const rejectAudit = await waitForAuditLog({ action: "APPOINTMENT_REJECTED", userId: docUserId });
    if (!rejectAudit) throw new Error("Audit log 'APPOINTMENT_REJECTED' not found");
    console.log(`✔ Audit Log recorded action = "${rejectAudit.action}"`);

    // Test transition: Rejected -> Approved (should be blocked)
    const rejectToApproved = await apiRequest("PATCH", `/appointments/${appt2Id}/approve`, { Authorization: `Bearer ${docToken}` });
    console.log(`[CHECK] PATCH /appointments/:id/approve (Rejected -> Approved): Status = ${rejectToApproved.statusCode} (Expected: 400)`);
    if (rejectToApproved.statusCode !== 400) throw new Error("Allowed forbidden transition: Rejected -> Approved");
    console.log("✔ Blocked transition Rejected -> Approved.");

    // --- TEST 5: APPOINTMENT CANCELLATION WORKFLOW (Requirement 4) ---
    console.log("\n--- [Test Case 5] Appointment Cancellation Workflow ---");

    // Attempt cancellation without reason
    const cancelNoReason = await apiRequest("PATCH", `/appointments/${appt1Id}/cancel`, { Authorization: `Bearer ${patientToken}` }, {});
    console.log(`[CHECK] PATCH /appointments/:id/cancel (No Reason): Status = ${cancelNoReason.statusCode} (Expected: 400)`);
    if (cancelNoReason.statusCode !== 400) throw new Error("Allowed cancellation without reason");

    // Cancel appointment (Patient)
    const cancelRes = await apiRequest("PATCH", `/appointments/${appt1Id}/cancel`, { Authorization: `Bearer ${patientToken}` }, { reason: "Personal emergency" });
    console.log(`[CHECK] PATCH /appointments/:id/cancel: Status = ${cancelRes.statusCode} (Expected: 200)`);
    if (cancelRes.statusCode !== 200) throw new Error("Cancellation failed");
    if (cancelRes.body.data.status !== "cancelled") throw new Error("Status was not updated to 'cancelled'");
    if (cancelRes.body.data.notes !== "Personal emergency") throw new Error("Cancellation reason not recorded");
    console.log("✔ Appointment cancelled and reason recorded.");

    // Audit Log verification
    const cancelAudit = await waitForAuditLog({ action: "APPOINTMENT_CANCELLED", userId: patientUserId });
    if (!cancelAudit) throw new Error("Audit log 'APPOINTMENT_CANCELLED' not found");
    console.log(`✔ Audit Log recorded action = "${cancelAudit.action}"`);

    // --- TEST 6: COMPLETE APPOINTMENT AND CANCEL BLOCKED (Requirement 4, 7, 8) ---
    console.log("\n--- [Test Case 6] Appointment Completion & Cancellation Blocked ---");

    // Book appointment 4
    const bookingPayload4 = {
      ...bookingPayload,
      startTime: "11:00",
      endTime: "11:30",
      reasonForVisit: "Appointment to complete.",
    };
    const book4Res = await apiRequest("POST", "/appointments", { Authorization: `Bearer ${patientToken}` }, bookingPayload4);
    const appt4Id = book4Res.body.data._id;

    // Approve it first
    await apiRequest("PATCH", `/appointments/${appt4Id}/approve`, { Authorization: `Bearer ${docToken}` });

    // Complete appointment (Doctor)
    const completeRes = await apiRequest("PATCH", `/appointments/${appt4Id}/complete`, { Authorization: `Bearer ${docToken}` });
    console.log(`[CHECK] PATCH /appointments/:id/complete: Status = ${completeRes.statusCode} (Expected: 200)`);
    if (completeRes.statusCode !== 200) throw new Error("Completing appointment failed");
    if (completeRes.body.data.status !== "completed") throw new Error("Status is not 'completed'");
    console.log("✔ Appointment completed successfully.");

    // Audit Log verification
    const completeAudit = await waitForAuditLog({ action: "APPOINTMENT_COMPLETED", userId: docUserId });
    if (!completeAudit) throw new Error("Audit log 'APPOINTMENT_COMPLETED' not found");
    console.log(`✔ Audit Log recorded action = "${completeAudit.action}"`);

    // Attempt to cancel completed appointment
    const cancelCompleted = await apiRequest("PATCH", `/appointments/${appt4Id}/cancel`, { Authorization: `Bearer ${patientToken}` }, { reason: "Change of plans" });
    console.log(`[CHECK] PATCH /appointments/:id/cancel (Completed Appt): Status = ${cancelCompleted.statusCode} (Expected: 400)`);
    if (cancelCompleted.statusCode !== 400) throw new Error("Allowed cancellation of completed appointment");
    console.log("✔ Blocked cancellation of completed appointment.");

    // --- TEST 7: RESCHEDULING WORKFLOW (Requirement 5) ---
    console.log("\n--- [Test Case 7] Appointment Rescheduling Workflow ---");

    // Book appointment 5
    const bookingPayload5 = {
      ...bookingPayload,
      startTime: "14:00",
      endTime: "14:30",
      reasonForVisit: "Appointment to reschedule.",
    };
    const book5Res = await apiRequest("POST", "/appointments", { Authorization: `Bearer ${patientToken}` }, bookingPayload5);
    const appt5Id = book5Res.body.data._id;

    // Valid reschedule (15:00 - 15:30)
    const reschedulePayload = {
      newDate: "2026-07-06",
      newStartTime: "15:00",
      newEndTime: "15:30",
    };
    const rescheduleRes = await apiRequest("PATCH", `/appointments/${appt5Id}/reschedule`, { Authorization: `Bearer ${patientToken}` }, reschedulePayload);
    console.log(`[CHECK] PATCH /appointments/:id/reschedule (Valid): Status = ${rescheduleRes.statusCode} (Expected: 200)`);
    if (rescheduleRes.statusCode !== 200) throw new Error("Rescheduling failed");
    if (rescheduleRes.body.data.startTime !== "15:00" || rescheduleRes.body.data.endTime !== "15:30") {
      throw new Error("Rescheduled times not updated correctly in database");
    }
    console.log("✔ Appointment rescheduled successfully.");

    // Audit Log verification
    const rescheduleAudit = await waitForAuditLog({ action: "APPOINTMENT_RESCHEDULED", userId: patientUserId });
    if (!rescheduleAudit) throw new Error("Audit log 'APPOINTMENT_RESCHEDULED' not found");
    console.log(`✔ Audit Log recorded action = "${rescheduleAudit.action}"`);

    // Invalid reschedule - outside working hours
    const rescheduleBadHours = await apiRequest("PATCH", `/appointments/${appt5Id}/reschedule`, { Authorization: `Bearer ${patientToken}` }, {
      newDate: "2026-07-06",
      newStartTime: "08:00", // Start is 09:00
      newEndTime: "08:30",
    });
    console.log(`[CHECK] PATCH /appointments/:id/reschedule (Bad Hours): Status = ${rescheduleBadHours.statusCode} (Expected: 400)`);
    if (rescheduleBadHours.statusCode !== 400) throw new Error("Reschedule allowed slots outside working hours");

    // Invalid reschedule - during break
    const rescheduleDuringBreak = await apiRequest("PATCH", `/appointments/${appt5Id}/reschedule`, { Authorization: `Bearer ${patientToken}` }, {
      newDate: "2026-07-06",
      newStartTime: "12:00", // Lunch is 12:00-13:00
      newEndTime: "12:30",
    });
    console.log(`[CHECK] PATCH /appointments/:id/reschedule (During Lunch): Status = ${rescheduleDuringBreak.statusCode} (Expected: 400)`);
    if (rescheduleDuringBreak.statusCode !== 400) throw new Error("Reschedule allowed slots during breaks");
    console.log("✔ Scheduling engine constraints applied correctly during rescheduling.");

    // --- TEST 8: RETRIEVAL APIS & RBAC (Requirement 6, 8) ---
    console.log("\n--- [Test Case 8] Retrieval APIs & Role-Based Access Controls ---");

    // Retrieve specific appointment by ID (Admin)
    const getApptAdmin = await apiRequest("GET", `/appointments/${appt5Id}`, { Authorization: `Bearer ${adminToken}` });
    console.log(`[CHECK] GET /appointments/:id (Admin): Status = ${getApptAdmin.statusCode} (Expected: 200)`);
    if (getApptAdmin.statusCode !== 200) throw new Error("Admin cannot retrieve appointment");

    // Retrieve specific appointment by ID (Patient owning it)
    const getApptPatient = await apiRequest("GET", `/appointments/${appt5Id}`, { Authorization: `Bearer ${patientToken}` });
    console.log(`[CHECK] GET /appointments/:id (Patient Owner): Status = ${getApptPatient.statusCode} (Expected: 200)`);
    if (getApptPatient.statusCode !== 200) throw new Error("Patient owner cannot retrieve appointment");

    // Retrieve patient appointments (filtering & pagination)
    const getPatientAppts = await apiRequest("GET", `/appointments/patient/${patientUserId}?status=pending&page=1`, { Authorization: `Bearer ${patientToken}` });
    console.log(`[CHECK] GET /appointments/patient/:patientId: Status = ${getPatientAppts.statusCode} (Expected: 200)`);
    if (getPatientAppts.statusCode !== 200) throw new Error("Retrieving patient appointments failed");
    if (!Array.isArray(getPatientAppts.body.data)) throw new Error("Expected array of appointments");
    console.log(`✔ Patient appointments list returned ${getPatientAppts.body.data.length} records. Total counts: ${getPatientAppts.body.pagination.total}`);

    // Retrieve doctor schedule (schedule=weekly)
    const getDocAppts = await apiRequest("GET", `/appointments/doctor/${docUserId}?schedule=weekly`, { Authorization: `Bearer ${docToken}` });
    console.log(`[CHECK] GET /appointments/doctor/:doctorId: Status = ${getDocAppts.statusCode} (Expected: 200)`);
    if (getDocAppts.statusCode !== 200) throw new Error("Retrieving doctor schedule failed");
    if (!Array.isArray(getDocAppts.body.data)) throw new Error("Expected array of appointments for doctor");
    console.log(`✔ Doctor schedule returned ${getDocAppts.body.data.length} records.`);

    // Retrieve upcoming appointments
    const getUpcomingAppts = await apiRequest("GET", "/appointments/upcoming", { Authorization: `Bearer ${patientToken}` });
    console.log(`[CHECK] GET /appointments/upcoming: Status = ${getUpcomingAppts.statusCode} (Expected: 200)`);
    if (getUpcomingAppts.statusCode !== 200) throw new Error("Retrieving upcoming appointments failed");
    if (!Array.isArray(getUpcomingAppts.body.data)) throw new Error("Expected array of upcoming appointments");
    console.log(`✔ Upcoming appointments list returned ${getUpcomingAppts.body.data.length} records.`);

    // RBAC: Patient attempts to access doctor schedule belonging to another doctor
    const badDocFetch = await apiRequest("GET", `/appointments/doctor/${docUserId}`, { Authorization: `Bearer ${patientToken}` });
    console.log(`[CHECK] GET /appointments/doctor/:doctorId (Patient Role): Status = ${badDocFetch.statusCode} (Expected: 403)`);
    if (badDocFetch.statusCode !== 403) throw new Error("RBAC: Allowed patient to fetch doctor schedule");

    // RBAC: Patient attempts to access another patient's appointment list
    const fakePatientId = new mongoose.Types.ObjectId();
    const badPatientFetch = await apiRequest("GET", `/appointments/patient/${fakePatientId}`, { Authorization: `Bearer ${patientToken}` });
    console.log(`[CHECK] GET /appointments/patient/:patientId (Foreign Patient): Status = ${badPatientFetch.statusCode} (Expected: 403)`);
    if (badPatientFetch.statusCode !== 403) throw new Error("RBAC: Allowed patient to fetch foreign patient's appointments");
    console.log("✔ Role-Based Access Controls successfully verified.");

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
    await AuditLog.deleteMany({ userId: { $in: userIds } });
    console.log("✔ Cleanup complete.");

    console.log("\n========================================================");
    console.log("🎉 ALL TESTS PASSED: APPOINTMENT LIFECYCLE WORKS PERFECTLY!");
    console.log("========================================================");

  } catch (error) {
    console.error("\n❌ TEST SUITE FAILED:", error);
    process.exitCode = 1;
  } finally {
    // Kill the server process
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

runTests();
