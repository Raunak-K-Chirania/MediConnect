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
const ClinicalNote = require("./modules/clinical-notes/clinical-note.model");

const PORT = 5998;
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
  console.log("🏥 STARTING INTEGRATION TEST SUITE: CLINICAL NOTES & MEDICAL RECORDS CRUD");
  console.log("================================================================================\n");

  let serverProcess = null;

  try {
    // 1. Connect to DB to manage test data state
    await connectDB();
    console.log("✔ Connected to MongoDB successfully.");

    // Clean up previous test users and audit logs
    const testEmails = [
      "test_doc_alice@example.com",
      "test_doc_bob@example.com",
      "test_patient_john@example.com",
      "test_patient_charlie@example.com",
      "test_admin@example.com"
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
    await ClinicalNote.deleteMany({
      $or: [
        { patientId: { $in: userIds } },
        { doctorId: { $in: userIds } }
      ]
    });
    await User.deleteMany({ _id: { $in: userIds } });
    await AuditLog.deleteMany({ userId: { $in: userIds } });
    console.log("✔ Cleanup complete (Removed old test data).");

    // 2. Start Express Server as a child process on port 5998
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
      email: "test_doc_alice@example.com",
      password: "password123",
      role: "Doctor",
      specialization: "Cardiology",
      licenseNumber: "LIC-ALICE-111",
    });
    if (docAliceRes.statusCode !== 201) throw new Error("Doctor Alice registration failed");
    const docAliceToken = docAliceRes.body.token;
    const docAliceUserId = docAliceRes.body.user.id;
    const docAliceProfile = await Doctor.findOne({ user: docAliceUserId });

    // Bob (Doctor - Unassigned)
    const docBobRes = await apiRequest("POST", "/api/auth/register", {}, {
      name: "Dr. Bob Jones",
      email: "test_doc_bob@example.com",
      password: "password123",
      role: "Doctor",
      specialization: "Pediatrics",
      licenseNumber: "LIC-BOB-222",
    });
    if (docBobRes.statusCode !== 201) throw new Error("Doctor Bob registration failed");
    const docBobToken = docBobRes.body.token;
    const docBobUserId = docBobRes.body.user.id;
    const docBobProfile = await Doctor.findOne({ user: docBobUserId });

    // John (Patient)
    const patientJohnRes = await apiRequest("POST", "/api/auth/register", {}, {
      name: "John Doe",
      email: "test_patient_john@example.com",
      password: "password123",
      role: "Patient",
      phone: "+15555555555",
      address: "456 Oak Street",
      dateOfBirth: "1990-01-01",
      emergencyContact: "+19999999999",
      allergies: ["Shellfish"],
      medicalHistory: ["Asthma"],
    });
    if (patientJohnRes.statusCode !== 201) throw new Error("Patient John registration failed");
    const patientJohnToken = patientJohnRes.body.token;
    const patientJohnUserId = patientJohnRes.body.user.id;
    const patientJohnProfile = await Patient.findOne({ user: patientJohnUserId });

    // Admin
    const adminRes = await apiRequest("POST", "/api/auth/register", {}, {
      name: "Admin User",
      email: "test_admin@example.com",
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

    // --- TEST AREA 1: MEDICAL RECORDS CRUD ---
    console.log("\n--- [Test Area 1] Medical Records Completion (CRUD) ---");

    // Let's create a medical record first
    const recordPayload = {
      patientId: patientJohnProfile._id.toString(),
      diagnosis: "Acute Bronchitis",
      symptoms: ["cough", "fever"],
      treatmentPlan: "Inhaler and bed rest",
      medications: ["Albuterol"],
      allergies: ["None"],
      notes: "Follow up in 2 weeks.",
      visitDate: new Date().toISOString(),
    };
    const createRecRes = await apiRequest("POST", "/api/records", { Authorization: `Bearer ${docAliceToken}` }, recordPayload);
    if (createRecRes.statusCode !== 201) throw new Error("Medical record creation failed");
    const recordId = createRecRes.body.medicalRecord._id;
    console.log(`✔ Medical record created. ID: ${recordId}`);

    // Test 1.1: PUT Update Medical Record (Approved Fields)
    const updatePayload = {
      diagnosis: "Acute Bronchitis Resolved",
      notes: "Fully recovered.",
      patientId: "60d00000000000000000000f", // Attempting to modify protected field
    };

    const updateRecRes = await apiRequest("PUT", `/medical-records/${recordId}`, { Authorization: `Bearer ${docAliceToken}` }, updatePayload);
    console.log(`[CHECK] PUT /medical-records/:id (Doctor Alice): Status = ${updateRecRes.statusCode} (Expected: 200)`);
    if (updateRecRes.statusCode !== 200) throw new Error("Medical record update failed");

    // Verify record state in MongoDB
    const updatedRecordInDb = await MedicalRecord.findById(recordId);
    console.log(`[CHECK] Stored record fields:
    - diagnosis: "${updatedRecordInDb.diagnosis}" (Expected: "Acute Bronchitis Resolved")
    - notes: "${updatedRecordInDb.notes}" (Expected: "Fully recovered.")
    - patientId: "${updatedRecordInDb.patientId.toString()}" (Expected to remain original: "${patientJohnProfile._id.toString()}")`);

    if (updatedRecordInDb.diagnosis !== "Acute Bronchitis Resolved" || updatedRecordInDb.notes !== "Fully recovered.") {
      throw new Error("Update check: Approved fields were not updated.");
    }
    if (updatedRecordInDb.patientId.toString() === "60d00000000000000000000f") {
      throw new Error("Security breach: Protected field 'patientId' was modified!");
    }
    console.log("✔ Medical record updates to approved/protected fields validated successfully.");

    // Verify Audit Log for update
    const updateAudit = await waitForAuditLog({ action: "MEDICAL_RECORD_UPDATED", userId: docAliceUserId });
    if (!updateAudit) throw new Error("Audit Log: Update log entry not found in database");
    console.log(`[CHECK] Medical Record Update Audit Log:
    - Action: "${updateAudit.action}" (Expected: "MEDICAL_RECORD_UPDATED")
    - Resource Type: "${updateAudit.resourceType}" (Expected: "MedicalRecord")
    - Resource ID: "${updateAudit.resourceId.toString()}" (Expected: "${recordId}")
    - Role: "${updateAudit.role}" (Expected: "Doctor")`);

    // Test 1.2: DELETE Soft Delete Medical Record
    const deleteRecRes = await apiRequest("DELETE", `/medical-records/${recordId}`, { Authorization: `Bearer ${docAliceToken}` });
    console.log(`[CHECK] DELETE /medical-records/:id (Doctor Alice): Status = ${deleteRecRes.statusCode} (Expected: 200)`);
    if (deleteRecRes.statusCode !== 200) throw new Error("Medical record deletion failed");

    // Verify soft delete state in MongoDB
    const deletedRecordInDb = await MedicalRecord.findById(recordId);
    console.log(`[CHECK] Deleted record in DB:
    - isDeleted: ${deletedRecordInDb.isDeleted} (Expected: true)
    - deletedAt: ${deletedRecordInDb.deletedAt} (Expected: non-null date)`);

    if (deletedRecordInDb.isDeleted !== true || !deletedRecordInDb.deletedAt) {
      throw new Error("Soft delete check: Model fields not set correctly.");
    }

    // Verify GET /medical-records/:id returns 404 for deleted record
    const getDeletedRecRes = await apiRequest("GET", `/medical-records/${recordId}`, { Authorization: `Bearer ${docAliceToken}` });
    console.log(`[CHECK] GET /medical-records/:id (Soft-deleted record): Status = ${getDeletedRecRes.statusCode} (Expected: 404)`);
    if (getDeletedRecRes.statusCode !== 404) {
      throw new Error("Soft delete check: GET API returned soft-deleted record!");
    }

    // Verify GET /medical-records/patient/:patientId does not return deleted record in array
    const getPatientRecsRes = await apiRequest("GET", `/medical-records/patient/${patientJohnProfile._id}`, { Authorization: `Bearer ${docAliceToken}` });
    console.log(`[CHECK] GET /medical-records/patient/:patientId list length: ${getPatientRecsRes.body.records ? getPatientRecsRes.body.records.length : 0} (Expected: 0)`);
    if (getPatientRecsRes.body.records && getPatientRecsRes.body.records.length > 0) {
      throw new Error("Soft delete check: List API returned soft-deleted record!");
    }
    console.log("✔ Medical record soft-deletion and query exclusions validated successfully.");

    // Verify Audit Log for deletion
    const deleteAudit = await waitForAuditLog({ action: "MEDICAL_RECORD_DELETED", userId: docAliceUserId });
    if (!deleteAudit) throw new Error("Audit Log: Delete log entry not found in database");
    console.log(`[CHECK] Medical Record Delete Audit Log:
    - Action: "${deleteAudit.action}" (Expected: "MEDICAL_RECORD_DELETED")
    - Resource Type: "${deleteAudit.resourceType}" (Expected: "MedicalRecord")
    - Resource ID: "${deleteAudit.resourceId.toString()}" (Expected: "${recordId}")
    - Role: "${deleteAudit.role}" (Expected: "Doctor")`);


    // --- TEST AREA 2: CLINICAL NOTES MODULE ---
    console.log("\n--- [Test Area 2] Clinical Notes Module ---");

    const notePayload = {
      appointmentId: appointment._id.toString(),
      patientId: patientJohnUserId.toString(),
      doctorId: docAliceUserId.toString(),
      subjectiveFindings: "Patient reports mild chest discomfort and fatigue.",
      objectiveFindings: "ECG shows normal sinus rhythm, heart rate 72 bpm.",
      assessment: "Stress-induced chest discomfort.",
      plan: "Recommend 7 hours of sleep and reducing caffeine. Check back in 1 week.",
      attachments: ["http://example.com/ecg_result.pdf"],
      consultationDate: new Date().toISOString(),
    };

    // Test 2.1: POST Create Clinical Note (Authorized Doctor Alice)
    const createNoteRes = await apiRequest("POST", "/clinical-notes", { Authorization: `Bearer ${docAliceToken}` }, notePayload);
    console.log(`[CHECK] POST /clinical-notes (Doctor Alice): Status = ${createNoteRes.statusCode} (Expected: 201)`);
    if (createNoteRes.statusCode !== 201) throw new Error("Clinical note creation failed");
    const noteId = createNoteRes.body.data._id;
    console.log(`✔ Clinical note created. ID: ${noteId}`);

    // Verify Audit Log for creation
    const createNoteAudit = await waitForAuditLog({ action: "CLINICAL_NOTE_CREATED", userId: docAliceUserId });
    if (!createNoteAudit) throw new Error("Audit Log: Clinical Note creation log not found");
    console.log(`[CHECK] Clinical Note Create Audit Log:
    - Action: "${createNoteAudit.action}" (Expected: "CLINICAL_NOTE_CREATED")
    - Resource Type: "${createNoteAudit.resourceType}" (Expected: "ClinicalNote")
    - Resource ID: "${createNoteAudit.resourceId.toString()}" (Expected: "${noteId}")`);

    // Test 2.2: Verify encryption in MongoDB directly
    console.log("Checking raw ClinicalNote data in DB...");
    const rawNote = await mongoose.connection.db.collection("clinicalnotes").findOne({ _id: new mongoose.Types.ObjectId(noteId) });
    const isSubjEnc = rawNote.subjectiveFindings.split(":").length === 3;
    const isObjEnc = rawNote.objectiveFindings.split(":").length === 3;
    const isAssessEnc = rawNote.assessment.split(":").length === 3;
    const isPlanEnc = rawNote.plan.split(":").length === 3;

    console.log(`[CHECK] Clinical Note Raw DB Storage:
    - subjectiveFindings: "${rawNote.subjectiveFindings}" | Encrypted? ${isSubjEnc}
    - objectiveFindings: "${rawNote.objectiveFindings}" | Encrypted? ${isObjEnc}
    - assessment: "${rawNote.assessment}" | Encrypted? ${isAssessEnc}
    - plan: "${rawNote.plan}" | Encrypted? ${isPlanEnc}`);

    if (!isSubjEnc || !isObjEnc || !isAssessEnc || !isPlanEnc) {
      throw new Error("PHI Encryption check: Clinical Note PHI fields were stored in plaintext in the database!");
    }
    console.log("✔ Clinical Note encryption validation succeeded.");

    // Test 2.3: POST Create Clinical Note (Unauthorized Doctor Bob - Not assigned via appointment)
    const bobPayload = { ...notePayload, doctorId: docBobUserId.toString() };
    const createNoteBobRes = await apiRequest("POST", "/clinical-notes", { Authorization: `Bearer ${docBobToken}` }, bobPayload);
    console.log(`[CHECK] POST /clinical-notes (Doctor Bob - Unassigned): Status = ${createNoteBobRes.statusCode} (Expected: 403)`);
    if (createNoteBobRes.statusCode !== 403) {
      throw new Error("Access validation check: Allowed unassigned doctor to write clinical note!");
    }

    // Test 2.4: POST Create Clinical Note (Access token role is Patient - Blocked at route)
    const createNotePatRes = await apiRequest("POST", "/clinical-notes", { Authorization: `Bearer ${patientJohnToken}` }, notePayload);
    console.log(`[CHECK] POST /clinical-notes (Patient Role): Status = ${createNotePatRes.statusCode} (Expected: 403)`);
    if (createNotePatRes.statusCode !== 403) {
      throw new Error("Access validation check: Allowed Patient role to write clinical note!");
    }

    // Test 2.5: GET /clinical-notes/:id RBAC Verification
    
    // Case A: Patient John (Owner) -> Allowed
    const viewNoteJohnRes = await apiRequest("GET", `/clinical-notes/${noteId}`, { Authorization: `Bearer ${patientJohnToken}` });
    console.log(`[CHECK] GET /clinical-notes/:id (Patient John - Owner): Status = ${viewNoteJohnRes.statusCode} (Expected: 200)`);
    if (viewNoteJohnRes.statusCode !== 200) throw new Error("Patient owner was unable to retrieve their clinical note");
    console.log(`  - Decrypted subjectiveFindings: "${viewNoteJohnRes.body.data.subjectiveFindings}" (Expected matches original)`);
    if (viewNoteJohnRes.body.data.subjectiveFindings !== notePayload.subjectiveFindings) {
      throw new Error("PHI Decryption check: Decrypted findings returned from GET API do not match original text!");
    }

    // Verify Audit Log for note view (John)
    const viewNoteJohnAudit = await waitForAuditLog({ action: "CLINICAL_NOTE_VIEWED", userId: patientJohnUserId });
    if (!viewNoteJohnAudit) throw new Error("Audit Log: Note view log not found for Patient");
    console.log(`[CHECK] Clinical Note View Audit Log (Patient): Action = "${viewNoteJohnAudit.action}", Role = "${viewNoteJohnAudit.role}"`);

    // Case B: Doctor Alice (Assigned via appointment) -> Allowed
    const viewNoteAliceRes = await apiRequest("GET", `/clinical-notes/${noteId}`, { Authorization: `Bearer ${docAliceToken}` });
    console.log(`[CHECK] GET /clinical-notes/:id (Doctor Alice - Assigned): Status = ${viewNoteAliceRes.statusCode} (Expected: 200)`);
    if (viewNoteAliceRes.statusCode !== 200) throw new Error("Assigned doctor was unable to retrieve clinical note");

    // Case C: Doctor Bob (Unassigned) -> Forbidden (403)
    const viewNoteBobRes = await apiRequest("GET", `/clinical-notes/${noteId}`, { Authorization: `Bearer ${docBobToken}` });
    console.log(`[CHECK] GET /clinical-notes/:id (Doctor Bob - Unassigned): Status = ${viewNoteBobRes.statusCode} (Expected: 403)`);
    if (viewNoteBobRes.statusCode !== 403) {
      throw new Error("Access validation check: Allowed unassigned doctor to view clinical note!");
    }

    // Case D: Admin -> Allowed
    const viewNoteAdminRes = await apiRequest("GET", `/clinical-notes/${noteId}`, { Authorization: `Bearer ${adminToken}` });
    console.log(`[CHECK] GET /clinical-notes/:id (Admin): Status = ${viewNoteAdminRes.statusCode} (Expected: 200)`);
    if (viewNoteAdminRes.statusCode !== 200) throw new Error("Admin was unable to retrieve clinical note");

    console.log("✔ Clinical Note RBAC Access Controls validated successfully.");

    // Test 2.6: GET Patient Clinical Notes (GET /clinical-notes/patient/:patientId)
    console.log("\nRunning Test 2.6: GET /clinical-notes/patient/:patientId...");

    // Register Charlie
    const patientCharlieRes = await apiRequest("POST", "/api/auth/register", {}, {
      name: "Charlie Brown",
      email: "test_patient_charlie@example.com",
      password: "password123",
      role: "Patient",
      phone: "+15555555556",
      address: "789 Pine Street",
      dateOfBirth: "1995-05-05",
      emergencyContact: "+19999999998",
      allergies: [],
      medicalHistory: [],
    });
    if (patientCharlieRes.statusCode !== 201) throw new Error("Patient Charlie registration failed");
    const patientCharlieToken = patientCharlieRes.body.token;
    const patientCharlieUserId = patientCharlieRes.body.user.id;
    const patientCharlieProfile = await Patient.findOne({ user: patientCharlieUserId });

    // Case A: Patient John Owner views own notes -> 200
    const viewPatientNotesJohn = await apiRequest("GET", `/clinical-notes/patient/${patientJohnProfile._id}`, { Authorization: `Bearer ${patientJohnToken}` });
    console.log(`[CHECK] Patient John views own notes: Status = ${viewPatientNotesJohn.statusCode} (Expected: 200)`);
    if (viewPatientNotesJohn.statusCode !== 200) throw new Error("Patient was unable to view their own clinical notes list");
    console.log("Pagination info:", JSON.stringify(viewPatientNotesJohn.body.data.pagination));
    if (!viewPatientNotesJohn.body.data.notes || viewPatientNotesJohn.body.data.notes.length !== 1) {
      throw new Error("Patient notes listing: notes length is incorrect");
    }
    // Verify populated fields
    const noteInList = viewPatientNotesJohn.body.data.notes[0];
    if (!noteInList.doctorId || !noteInList.doctorId.name || !noteInList.appointmentId) {
      throw new Error("Populate check: doctor/appointment details were not populated in notes list");
    }

    // Case B: Patient Charlie views John's notes -> 403
    const viewPatientNotesCharlie = await apiRequest("GET", `/clinical-notes/patient/${patientJohnProfile._id}`, { Authorization: `Bearer ${patientCharlieToken}` });
    console.log(`[CHECK] Patient Charlie views John's notes: Status = ${viewPatientNotesCharlie.statusCode} (Expected: 403)`);
    if (viewPatientNotesCharlie.statusCode !== 403) {
      throw new Error("Access validation check: Allowed another patient to retrieve patient clinical notes!");
    }

    // Case C: Doctor Alice (Assigned) views John's notes -> 200
    const viewPatientNotesAlice = await apiRequest("GET", `/clinical-notes/patient/${patientJohnProfile._id}`, { Authorization: `Bearer ${docAliceToken}` });
    console.log(`[CHECK] Doctor Alice (Assigned) views John's notes: Status = ${viewPatientNotesAlice.statusCode} (Expected: 200)`);
    if (viewPatientNotesAlice.statusCode !== 200) throw new Error("Assigned doctor was unable to retrieve patient clinical notes list");

    // Case D: Doctor Bob (Unassigned) views John's notes -> 403
    const viewPatientNotesBob = await apiRequest("GET", `/clinical-notes/patient/${patientJohnProfile._id}`, { Authorization: `Bearer ${docBobToken}` });
    console.log(`[CHECK] Doctor Bob (Unassigned) views John's notes: Status = ${viewPatientNotesBob.statusCode} (Expected: 403)`);
    if (viewPatientNotesBob.statusCode !== 403) {
      throw new Error("Access validation check: Allowed unassigned doctor to retrieve patient clinical notes list!");
    }

    // Case E: Admin views John's notes -> 200
    const viewPatientNotesAdmin = await apiRequest("GET", `/clinical-notes/patient/${patientJohnProfile._id}`, { Authorization: `Bearer ${adminToken}` });
    console.log(`[CHECK] Admin views John's notes: Status = ${viewPatientNotesAdmin.statusCode} (Expected: 200)`);
    if (viewPatientNotesAdmin.statusCode !== 200) throw new Error("Admin was unable to retrieve patient clinical notes list");

    // Verify Audit log for patient notes viewed
    const patientNotesViewAudit = await waitForAuditLog({ action: "CLINICAL_NOTE_VIEWED", userId: patientJohnUserId });
    if (!patientNotesViewAudit) throw new Error("Audit Log: Patient notes view log not found for John");
    console.log("✔ Patient notes listing and RBAC access validation succeeded.");

    // Test 2.7: Update Clinical Note (PUT /clinical-notes/:id)
    console.log("\nRunning Test 2.7: PUT /clinical-notes/:id...");

    const updateNotePayload = {
      assessment: "Updated Assessment: Recovering well",
      plan: "Reduce medication dosage. Plan follow-up.",
    };

    // Case A: Doctor Alice (Creator) updates note -> 200
    const updateNoteAlice = await apiRequest("PUT", `/clinical-notes/${noteId}`, { Authorization: `Bearer ${docAliceToken}` }, updateNotePayload);
    console.log(`[CHECK] Doctor Alice (Creator) updates note: Status = ${updateNoteAlice.statusCode} (Expected: 200)`);
    if (updateNoteAlice.statusCode !== 200) throw new Error("Authoring doctor was unable to update clinical note");
    console.log(`Updated assessment in response: "${updateNoteAlice.body.data.assessment}"`);

    // Verify in DB directly
    const noteInDbAfterUpdate = await ClinicalNote.findById(noteId);
    if (noteInDbAfterUpdate.assessment !== "Updated Assessment: Recovering well") {
      throw new Error("Update check: assessment field was not updated in DB");
    }

    // Case B: Doctor Bob (Not Creator) updates note -> 403
    const updateNoteBob = await apiRequest("PUT", `/clinical-notes/${noteId}`, { Authorization: `Bearer ${docBobToken}` }, updateNotePayload);
    console.log(`[CHECK] Doctor Bob (Not Creator) updates note: Status = ${updateNoteBob.statusCode} (Expected: 403)`);
    if (updateNoteBob.statusCode !== 403) {
      throw new Error("Access validation check: Allowed another doctor to update clinical note!");
    }

    // Case C: Patient John updates note -> 403
    const updateNoteJohn = await apiRequest("PUT", `/clinical-notes/${noteId}`, { Authorization: `Bearer ${patientJohnToken}` }, updateNotePayload);
    console.log(`[CHECK] Patient John updates note: Status = ${updateNoteJohn.statusCode} (Expected: 403)`);
    if (updateNoteJohn.statusCode !== 403) {
      throw new Error("Access validation check: Allowed Patient to update clinical note!");
    }

    // Case D: Admin (Compliance Access) updates note -> 200
    const adminUpdatePayload = { assessment: "Compliance review completed by Admin" };
    const updateNoteAdmin = await apiRequest("PUT", `/clinical-notes/${noteId}`, { Authorization: `Bearer ${adminToken}` }, adminUpdatePayload);
    console.log(`[CHECK] Admin (Compliance) updates note: Status = ${updateNoteAdmin.statusCode} (Expected: 200)`);
    if (updateNoteAdmin.statusCode !== 200) throw new Error("Admin was unable to update clinical note");

    // Verify Audit log for note update
    const noteUpdateAudit = await waitForAuditLog({ action: "CLINICAL_NOTE_UPDATED", userId: adminUserId });
    if (!noteUpdateAudit) throw new Error("Audit Log: Note update log not found for Admin");
    console.log("✔ Clinical Note updates and RBAC access validation succeeded.");

    // Test 2.8: Delete Clinical Note (Soft Delete) (DELETE /clinical-notes/:id)
    console.log("\nRunning Test 2.8: DELETE /clinical-notes/:id (Soft Delete)...");

    // Case A: Doctor Bob (Not Creator) tries to delete -> 403
    const deleteNoteBob = await apiRequest("DELETE", `/clinical-notes/${noteId}`, { Authorization: `Bearer ${docBobToken}` });
    console.log(`[CHECK] Doctor Bob (Not Creator) deletes note: Status = ${deleteNoteBob.statusCode} (Expected: 403)`);
    if (deleteNoteBob.statusCode !== 403) {
      throw new Error("Access validation check: Allowed another doctor to delete clinical note!");
    }

    // Case B: Patient John tries to delete -> 403
    const deleteNoteJohn = await apiRequest("DELETE", `/clinical-notes/${noteId}`, { Authorization: `Bearer ${patientJohnToken}` });
    console.log(`[CHECK] Patient John deletes note: Status = ${deleteNoteJohn.statusCode} (Expected: 403)`);
    if (deleteNoteJohn.statusCode !== 403) {
      throw new Error("Access validation check: Allowed Patient to delete clinical note!");
    }

    // Case C: Doctor Alice (Creator) deletes note -> 200
    const deleteNoteAlice = await apiRequest("DELETE", `/clinical-notes/${noteId}`, { Authorization: `Bearer ${docAliceToken}` });
    console.log(`[CHECK] Doctor Alice (Creator) deletes note: Status = ${deleteNoteAlice.statusCode} (Expected: 200)`);
    if (deleteNoteAlice.statusCode !== 200) throw new Error("Authoring doctor was unable to delete clinical note");

    // Verify Soft Delete state in DB
    const deletedNoteInDb = await ClinicalNote.findById(noteId);
    console.log(`[CHECK] Soft Delete field status in DB: isDeleted = ${deletedNoteInDb.isDeleted}, deletedAt = ${deletedNoteInDb.deletedAt}`);
    if (deletedNoteInDb.isDeleted !== true || !deletedNoteInDb.deletedAt) {
      throw new Error("Soft delete check: Clinical Note model isDeleted/deletedAt fields not set correctly");
    }

    // Verify GET /clinical-notes/:id returns 404 for soft-deleted note
    const getDeletedNote = await apiRequest("GET", `/clinical-notes/${noteId}`, { Authorization: `Bearer ${docAliceToken}` });
    console.log(`[CHECK] GET /clinical-notes/:id (Soft-deleted note): Status = ${getDeletedNote.statusCode} (Expected: 404)`);
    if (getDeletedNote.statusCode !== 404) {
      throw new Error("Soft delete check: GET API returned soft-deleted clinical note!");
    }

    // Verify GET /clinical-notes/patient/:patientId does not return it
    const getPatientNotesAfterDelete = await apiRequest("GET", `/clinical-notes/patient/${patientJohnProfile._id}`, { Authorization: `Bearer ${docAliceToken}` });
    console.log(`[CHECK] GET /clinical-notes/patient/:patientId list length: ${getPatientNotesAfterDelete.body.data.notes ? getPatientNotesAfterDelete.body.data.notes.length : 0} (Expected: 0)`);
    if (getPatientNotesAfterDelete.body.data.notes && getPatientNotesAfterDelete.body.data.notes.length > 0) {
      throw new Error("Soft delete check: List API returned soft-deleted clinical note!");
    }

    // Verify Audit log for note delete
    const noteDeleteAudit = await waitForAuditLog({ action: "CLINICAL_NOTE_DELETED", userId: docAliceUserId });
    if (!noteDeleteAudit) throw new Error("Audit Log: Note deletion log not found for Doctor Alice");
    console.log("✔ Clinical Note soft deletion and query exclusions validated successfully.");

    // --- TEST AREA 3: STANDARDIZED ERROR HANDLING ---
    console.log("\n--- [Test Area 3] Standardized Error Handling ---");

    // Test 3.1: Invalid ObjectId format -> Expected status 400 with success: false
    const invalidIdRes = await apiRequest("GET", "/clinical-notes/invalid_object_id", { Authorization: `Bearer ${adminToken}` });
    console.log(`[CHECK] GET /clinical-notes/invalid_id: Status = ${invalidIdRes.statusCode} (Expected: 400)`);
    console.log("Response Body:", JSON.stringify(invalidIdRes.body, null, 2));
    
    if (invalidIdRes.statusCode !== 400 || invalidIdRes.body.success !== false || !invalidIdRes.body.message.includes("Invalid MongoDB ObjectId format")) {
      throw new Error("Error handling check: Invalid ObjectId response format is incorrect!");
    }

    // Test 3.2: Validation Error (Missing fields) -> Expected status 400 with success: false
    const incompletePayload = {
      appointmentId: appointment._id.toString(),
      // missing patientId, doctorId, etc.
    };
    const validationErrRes = await apiRequest("POST", "/clinical-notes", { Authorization: `Bearer ${docAliceToken}` }, incompletePayload);
    console.log(`[CHECK] POST /clinical-notes (Incomplete payload): Status = ${validationErrRes.statusCode} (Expected: 400)`);
    console.log("Response Body:", JSON.stringify(validationErrRes.body, null, 2));

    if (validationErrRes.statusCode !== 400 || validationErrRes.body.success !== false || !validationErrRes.body.message.includes("Validation error")) {
      throw new Error("Error handling check: Validation error response format is incorrect!");
    }

    // Clean up test records
    console.log("\nCleaning up test database records...");
    const finalExistingUsers = await User.find({ email: { $in: testEmails } });
    const finalUserIds = finalExistingUsers.map((u) => u._id);
    
    const finalExistingPatients = await Patient.find({ user: { $in: finalUserIds } });
    const finalPatientIds = finalExistingPatients.map((p) => p._id);
    const finalExistingDoctors = await Doctor.find({ user: { $in: finalUserIds } });
    const finalDoctorIds = finalExistingDoctors.map((d) => d._id);

    await Appointment.deleteMany({
      $or: [
        { patient: { $in: finalPatientIds } },
        { doctor: { $in: finalDoctorIds } }
      ]
    });
    await Patient.deleteMany({ user: { $in: finalUserIds } });
    await Doctor.deleteMany({ user: { $in: finalUserIds } });
    await MedicalRecord.deleteMany({ patientId: { $in: finalPatientIds } });
    await ClinicalNote.deleteMany({
      $or: [
        { patientId: { $in: finalUserIds } },
        { doctorId: { $in: finalUserIds } }
      ]
    });
    await User.deleteMany({ _id: { $in: finalUserIds } });
    await AuditLog.deleteMany({ userId: { $in: finalUserIds } });
    console.log("✔ Cleanup complete.");

    console.log("\n========================================================");
    console.log("🎉 ALL TESTS PASSED: EHR INTEGRATION WORKS!");
    console.log("========================================================");

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

runTests();
