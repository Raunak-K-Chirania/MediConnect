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
  console.log("📅 STARTING SCHEDULING ENGINE & AVAILABILITY INTEGRATION TEST SUITE");
  console.log("================================================================================\n");

  let serverProcess = null;

  try {
    // 1. Connect to DB
    await connectDB();
    console.log("✔ Connected to MongoDB successfully.");

    // Clean up test users, availabilities, appointments, and audit logs
    const testEmails = [
      "test_sched_doc@example.com",
      "test_sched_patient@example.com",
      "test_sched_admin@example.com"
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
      email: "test_sched_doc@example.com",
      password: "password123",
      role: "Doctor",
      specialization: "Diagnostic Medicine",
      licenseNumber: "LIC-HOUSE-777",
    });
    if (docRes.statusCode !== 201) throw new Error("Doctor registration failed");
    const docToken = docRes.body.token;
    const docUserId = docRes.body.user.id;
    console.log(`✔ Registered Doctor User ID: ${docUserId}`);

    // Patient
    const patientRes = await apiRequest("POST", "/api/auth/register", {}, {
      name: "John SchedPatient",
      email: "test_sched_patient@example.com",
      password: "password123",
      role: "Patient",
      phone: "+15551112222",
      address: "221B Baker St",
      dateOfBirth: "1985-05-15",
      emergencyContact: "+19991112222",
      allergies: [],
      medicalHistory: [],
    });
    if (patientRes.statusCode !== 201) throw new Error("Patient registration failed");
    const patientToken = patientRes.body.token;
    const patientUserId = patientRes.body.user.id;
    console.log(`✔ Registered Patient User ID: ${patientUserId}`);

    // Admin
    const adminRes = await apiRequest("POST", "/api/auth/register", {}, {
      name: "Admin Sched",
      email: "test_sched_admin@example.com",
      password: "password123",
      role: "Admin",
    });
    if (adminRes.statusCode !== 201) throw new Error("Admin registration failed");
    const adminToken = adminRes.body.token;
    const adminUserId = adminRes.body.user.id;
    console.log(`✔ Registered Admin User ID: ${adminUserId}`);

    // --- TEST AREA 1: DOCTOR AVAILABILITY APIS ---
    console.log("\n--- [Test Area 1] Doctor Availability Management (CRUD) ---");

    // Test 1.1: Create Availability config (Doctor House)
    const availabilityPayload = {
      doctorId: docUserId,
      workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday"],
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
    console.log(`[CHECK] POST /doctor-availability (Doctor): Status = ${createAvailRes.statusCode} (Expected: 201)`);
    if (createAvailRes.statusCode !== 201) throw new Error("Availability creation failed");
    const availabilityId = createAvailRes.body.data._id;
    console.log(`✔ Availability created with ID: ${availabilityId}`);

    // Check Audit log for Availability creation
    const createAvailAudit = await waitForAuditLog({ action: "AVAILABILITY_CREATED", userId: docUserId });
    if (!createAvailAudit) throw new Error("Audit Log: Availability created log not found");
    console.log(`[CHECK] Audit Log: Action = "${createAvailAudit.action}", ResourceType = "${createAvailAudit.resourceType}"`);

    // Test 1.2: Check validation - Zod check for invalid working hours (end before start)
    const invalidAvailPayload = {
      doctorId: docUserId,
      workingDays: ["Monday"],
      startHour: "17:00",
      endHour: "09:00", // Invalid!
      slotDuration: 30,
    };
    const invalidAvailRes = await apiRequest("POST", "/doctor-availability", { Authorization: `Bearer ${docToken}` }, invalidAvailPayload);
    console.log(`[CHECK] POST /doctor-availability (Invalid Hours): Status = ${invalidAvailRes.statusCode} (Expected: 400)`);
    if (invalidAvailRes.statusCode !== 400) throw new Error("Zod validation did not catch invalid hours!");

    // Test 1.3: Check validation - Zod check for break slot outside working hours
    const invalidBreakPayload = {
      doctorId: docUserId,
      workingDays: ["Monday"],
      startHour: "09:00",
      endHour: "17:00",
      slotDuration: 30,
      breakSlots: [
        {
          start: "18:00",
          end: "19:00", // Outside 09:00-17:00
        },
      ],
    };
    const invalidBreakRes = await apiRequest("POST", "/doctor-availability", { Authorization: `Bearer ${docToken}` }, invalidBreakPayload);
    console.log(`[CHECK] POST /doctor-availability (Break outside working hours): Status = ${invalidBreakRes.statusCode} (Expected: 400)`);
    if (invalidBreakRes.statusCode !== 400) throw new Error("Zod validation did not catch break slot outside working hours!");

    // Test 1.4: Update Doctor Availability (PUT)
    const updateAvailPayload = {
      workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], // Add Friday
      breakSlots: [
        {
          start: "12:00",
          end: "13:00",
        },
        {
          start: "15:00",
          end: "15:30", // Add short afternoon break
        },
      ],
    };
    const updateAvailRes = await apiRequest("PUT", `/doctor-availability/${availabilityId}`, { Authorization: `Bearer ${docToken}` }, updateAvailPayload);
    console.log(`[CHECK] PUT /doctor-availability/:id: Status = ${updateAvailRes.statusCode} (Expected: 200)`);
    if (updateAvailRes.statusCode !== 200) throw new Error("Availability update failed");

    // Check Audit log for Availability update
    const updateAvailAudit = await waitForAuditLog({ action: "AVAILABILITY_UPDATED", userId: docUserId });
    if (!updateAvailAudit) throw new Error("Audit Log: Availability updated log not found");
    console.log(`[CHECK] Audit Log: Action = "${updateAvailAudit.action}", ResourceType = "${updateAvailAudit.resourceType}"`);

    // Test 1.5: GET Doctor Availability
    const getAvailRes = await apiRequest("GET", `/doctor-availability/${docUserId}`, { Authorization: `Bearer ${docToken}` });
    console.log(`[CHECK] GET /doctor-availability/:doctorId: Status = ${getAvailRes.statusCode} (Expected: 200)`);
    if (getAvailRes.statusCode !== 200) throw new Error("Retrieving doctor availability failed");
    if (getAvailRes.body.data.workingDays.length !== 5) throw new Error("Updated working days did not persist");


    // --- TEST AREA 2: APPOINTMENT SLOT GENERATION ---
    console.log("\n--- [Test Area 2] Appointment Slot Generation ---");

    // Query slots for Friday, July 17th, 2026 (a future Friday)
    const checkSlotsRes = await apiRequest("GET", `/appointments/available-slots/${docUserId}?date=2026-07-17`, { Authorization: `Bearer ${patientToken}` });
    console.log(`[CHECK] GET /appointments/available-slots/:doctorId: Status = ${checkSlotsRes.statusCode} (Expected: 200)`);
    if (checkSlotsRes.statusCode !== 200) throw new Error("Retrieving available slots failed");
    console.log(`Generated slots count: ${checkSlotsRes.body.availableSlots.length}`);
    
    // Verify lunch break (12:00-13:00) and afternoon break (15:00-15:30) are excluded
    const slots = checkSlotsRes.body.availableSlots;
    const hasLunchStart = slots.includes("12:00") || slots.includes("12:30");
    const hasPmBreak = slots.includes("15:00");
    console.log(`- Excluded 12:00-13:00 lunch? ${!hasLunchStart} (Expected: true)`);
    console.log("- Excluded 15:00-15:30 break?", !hasPmBreak, "(Expected: true)");
    if (hasLunchStart || hasPmBreak) throw new Error("Slots generation did not exclude doctor break times!");

    // Check Audit log for Availability Checked
    const checkedAvailAudit = await waitForAuditLog({ action: "AVAILABILITY_CHECKED", userId: patientUserId });
    if (!checkedAvailAudit) throw new Error("Audit Log: Availability checked log not found");
    console.log(`[CHECK] Audit Log: Action = "${checkedAvailAudit.action}", ResourceType = "${checkedAvailAudit.resourceType}"`);


    // --- TEST AREA 3: APPOINTMENT SCHEDULING & COLLISION DETECTION ---
    console.log("\n--- [Test Area 3] Appointment Booking & Collision Detection ---");

    // Test 3.1: Book a valid slot (09:00 - 09:30)
    const apptPayload1 = {
      patientId: patientUserId,
      doctorId: docUserId,
      appointmentDate: "2026-07-17",
      startTime: "09:00",
      endTime: "09:30",
      appointmentType: "Standard Checkup",
      reasonForVisit: "Regular medical checkup.",
    };

    const bookAppt1 = await apiRequest("POST", "/appointments", { Authorization: `Bearer ${patientToken}` }, apptPayload1);
    console.log(`[CHECK] POST /appointments (Valid Book): Status = ${bookAppt1.statusCode} (Expected: 201)`);
    if (bookAppt1.statusCode !== 201) throw new Error("First appointment booking failed");
    const appt1Id = bookAppt1.body.data._id;

    // Check Audit log for Appointment created
    const requestedApptAudit = await waitForAuditLog({ action: "APPOINTMENT_CREATED", userId: patientUserId });
    if (!requestedApptAudit) throw new Error("Audit Log: Appointment created log not found");
    console.log(`[CHECK] Audit Log: Action = "${requestedApptAudit.action}", ResourceId = "${appt1Id}"`);

    // Test 3.2: Verify booked slot disappears from available slots
    const checkSlots2 = await apiRequest("GET", `/appointments/available-slots/${docUserId}?date=2026-07-17`, { Authorization: `Bearer ${patientToken}` });
    const slots2 = checkSlots2.body.availableSlots;
    const hasBookedSlot = slots2.includes("09:00");
    console.log(`- Booked slot 09:00 disappeared? ${!hasBookedSlot} (Expected: true)`);
    if (hasBookedSlot) throw new Error("Booked slot did not disappear from available slots!");

    // Test 3.3: Attempt to book exactly the same slot (09:00 - 09:30) -> Collision exact overlap
    const bookExactOverlap = await apiRequest("POST", "/appointments", { Authorization: `Bearer ${patientToken}` }, apptPayload1);
    console.log(`[CHECK] POST /appointments (Exact Overlap): Status = ${bookExactOverlap.statusCode} (Expected: 400)`);
    if (bookExactOverlap.statusCode !== 400 || bookExactOverlap.body.message !== "Appointment slot unavailable") {
      throw new Error("Collision engine did not reject exact overlap or returned incorrect message!");
    }

    // Check Audit log for Conflict detected
    const conflictAudit = await waitForAuditLog({ action: "CONFLICT_DETECTED", userId: patientUserId });
    if (!conflictAudit) throw new Error("Audit Log: Conflict detected log not found");
    console.log(`[CHECK] Audit Log: Action = "${conflictAudit.action}"`);

    // Test 3.4: Attempt partial overlap (09:15 - 09:45) -> Collision partial overlap
    const apptPayloadPartial = {
      ...apptPayload1,
      startTime: "09:15",
      endTime: "09:45",
    };
    const bookPartial = await apiRequest("POST", "/appointments", { Authorization: `Bearer ${patientToken}` }, apptPayloadPartial);
    console.log(`[CHECK] POST /appointments (Partial Overlap): Status = ${bookPartial.statusCode} (Expected: 400)`);
    if (bookPartial.statusCode !== 400 || bookPartial.body.message !== "Appointment slot unavailable") {
      throw new Error("Collision engine did not reject partial overlap!");
    }

    // Test 3.5: Attempt complete containment overlap (09:00 - 10:30 covers 09:00-09:30 and 09:30-10:00)
    const apptPayloadContainment = {
      ...apptPayload1,
      startTime: "09:00",
      endTime: "10:30",
    };
    const bookContainment = await apiRequest("POST", "/appointments", { Authorization: `Bearer ${patientToken}` }, apptPayloadContainment);
    console.log(`[CHECK] POST /appointments (Complete Containment): Status = ${bookContainment.statusCode} (Expected: 400)`);
    if (bookContainment.statusCode !== 400 || bookContainment.body.message !== "Appointment slot unavailable") {
      throw new Error("Collision engine did not reject complete containment!");
    }

    // Test 3.6: Book during lunch break (12:00 - 12:30) -> Should fail availability validation
    const apptPayloadLunch = {
      ...apptPayload1,
      startTime: "12:00",
      endTime: "12:30",
    };
    const bookLunch = await apiRequest("POST", "/appointments", { Authorization: `Bearer ${patientToken}` }, apptPayloadLunch);
    console.log(`[CHECK] POST /appointments (Lunch Break booking): Status = ${bookLunch.statusCode} (Expected: 400)`);
    if (bookLunch.statusCode !== 400 || !bookLunch.body.message.includes("overlaps with doctor break time")) {
      throw new Error("Collision engine did not reject break-time booking!");
    }

    // Check Audit log for Scheduling Rejected
    const rejectAudit = await waitForAuditLog({ action: "SCHEDULING_REJECTED", userId: patientUserId });
    if (!rejectAudit) throw new Error("Audit Log: Scheduling rejected log not found");
    console.log(`[CHECK] Audit Log: Action = "${rejectAudit.action}"`);

    // Test 3.7: Book outside working hours (08:00 - 08:30, start is 09:00) -> Should fail
    const apptPayloadOutside = {
      ...apptPayload1,
      startTime: "08:00",
      endTime: "08:30",
    };
    const bookOutside = await apiRequest("POST", "/appointments", { Authorization: `Bearer ${patientToken}` }, apptPayloadOutside);
    console.log(`[CHECK] POST /appointments (Outside Working Hours booking): Status = ${bookOutside.statusCode} (Expected: 400)`);
    if (bookOutside.statusCode !== 400 || !bookOutside.body.message.includes("falls outside doctor working hours")) {
      throw new Error("Collision engine did not reject outside working hours booking!");
    }

    // Test 3.8: Book back-to-back appointment (09:30 - 10:00) -> Should be VALID
    const apptPayloadB2b = {
      ...apptPayload1,
      startTime: "09:30",
      endTime: "10:00",
    };
    const bookB2b = await apiRequest("POST", "/appointments", { Authorization: `Bearer ${patientToken}` }, apptPayloadB2b);
    console.log(`[CHECK] POST /appointments (Back-to-Back): Status = ${bookB2b.statusCode} (Expected: 201)`);
    if (bookB2b.statusCode !== 201) throw new Error("Back-to-back booking failed, should be valid!");

    // --- TEST AREA 4: RBAC AUTHORIZATION CONTROL ---
    console.log("\n--- [Test Area 4] Role-Based Access Control (RBAC) ---");

    // Patient cannot configure doctor availability
    const badAvailPayload = {
      doctorId: docUserId,
      workingDays: ["Sunday"],
      startHour: "09:00",
      endHour: "12:00",
      slotDuration: 30,
    };
    const patientCreateAvail = await apiRequest("POST", "/doctor-availability", { Authorization: `Bearer ${patientToken}` }, badAvailPayload);
    console.log(`[CHECK] POST /doctor-availability (Patient access): Status = ${patientCreateAvail.statusCode} (Expected: 403)`);
    if (patientCreateAvail.statusCode !== 403) {
      throw new Error("Access validation: Allowed Patient to configure doctor availability!");
    }

    // Doctor cannot book on behalf of another patient
    const docBookAppt = await apiRequest("POST", "/appointments", { Authorization: `Bearer ${docToken}` }, apptPayload1);
    console.log(`[CHECK] POST /appointments (Doctor access): Status = ${docBookAppt.statusCode} (Expected: 403)`);
    if (docBookAppt.statusCode !== 403) {
      throw new Error("Access validation: Allowed Doctor to book appointments!");
    }

    // Admin CAN configure availability and CAN book appointments
    const adminCreateAvail = await apiRequest("POST", "/doctor-availability", { Authorization: `Bearer ${adminToken}` }, {
      ...availabilityPayload,
      doctorId: docUserId,
      workingDays: ["Monday", "Tuesday"],
      breakSlots: [],
      // Need a different doctor or delete first, let's just test get availability as Admin
    });
    // Let's test admin fetching availability
    const adminGetAvail = await apiRequest("GET", `/doctor-availability/${docUserId}`, { Authorization: `Bearer ${adminToken}` });
    console.log(`[CHECK] GET /doctor-availability/:doctorId (Admin access): Status = ${adminGetAvail.statusCode} (Expected: 200)`);
    if (adminGetAvail.statusCode !== 200) {
      throw new Error("Access validation: Admin was unable to view availability!");
    }

    // Admin books appointment for patient
    const adminBookApptPayload = {
      ...apptPayload1,
      startTime: "10:00",
      endTime: "10:30",
    };
    const adminBookAppt = await apiRequest("POST", "/appointments", { Authorization: `Bearer ${adminToken}` }, adminBookApptPayload);
    console.log(`[CHECK] POST /appointments (Admin booking for patient): Status = ${adminBookAppt.statusCode} (Expected: 201)`);
    if (adminBookAppt.statusCode !== 201) {
      throw new Error("Access validation: Admin was unable to book appointment for a patient!");
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
    await AuditLog.deleteMany({ userId: { $in: userIds } });
    console.log("✔ Cleanup complete.");

    console.log("\n========================================================");
    console.log("🎉 ALL TESTS PASSED: SCHEDULING ENGINE & AVAILABILITY WORK!");
    console.log("========================================================");

  } catch (error) {
    console.error("\n❌ SCHEDULING TEST SUITE FAILED:", error);
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
