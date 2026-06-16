const path = require("path");
// Load environment variables
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/User");
const Patient = require("./models/Patient");
const Doctor = require("./models/Doctor");
const MedicalRecord = require("./models/Medicalrecord");
const Prescription = require("./models/Prescription");

const testData = {
  patientEmail: "test_encrypt_patient@example.com",
  doctorEmail: "test_encrypt_doctor@example.com",
  patientPhone: "+1234567890",
  patientAddress: "123 Health Ave, Secure City",
  patientDOB: "1995-05-15",
  patientEmergency: "+9876543210",
  patientAllergies: ["Penicillin", "Peanuts"],
  patientHistory: ["Hypertension", "Asthma"],
  doctorLicense: "DOC-LICENSE-999",
  diagnosis: "Mild seasonal influenza",
  symptoms: ["fever", "cough", "runny nose"],
  notes: "Patient advised rest for 3 days and plenty of fluids.",
};

const runTest = async () => {
  console.log("=== Starting PHI Encryption Verification Workflow ===\n");

  try {
    // 1. Connect to DB
    await connectDB();
    console.log("1. Connected to database successfully.");

    // Clean up any old test records first
    const cleanOldUserEmails = [testData.patientEmail, testData.doctorEmail];
    const oldUsers = await User.find({ email: { $in: cleanOldUserEmails } });
    const oldUserIds = oldUsers.map((u) => u._id);
    
    await Patient.deleteMany({ user: { $in: oldUserIds } });
    await Doctor.deleteMany({ user: { $in: oldUserIds } });
    await User.deleteMany({ _id: { $in: oldUserIds } });
    console.log("Cleanup: Removed existing test users.");

    // 2. Create Patient and Doctor Users
    const doctorUser = new User({
      name: "Dr. Alice Smith",
      email: testData.doctorEmail,
      password: "password123",
      role: "Doctor",
    });
    await doctorUser.save();

    const doctorProfile = new Doctor({
      user: doctorUser._id,
      specialization: "General Medicine",
      qualification: "MD",
      experience: 10,
      licenseNumber: testData.doctorLicense,
    });
    await doctorProfile.save();

    const patientUser = new User({
      name: "John Doe",
      email: testData.patientEmail,
      password: "password123",
      role: "Patient",
    });
    await patientUser.save();

    console.log("2. Created User and Doctor profiles.");

    // 3. Create Patient Profile (Triggers Mongoose Save Hooks & Encryption)
    const patientProfile = new Patient({
      user: patientUser._id,
      dateOfBirth: testData.patientDOB,
      gender: "Male",
      bloodGroup: "O+",
      phone: testData.patientPhone,
      address: testData.patientAddress,
      emergencyContact: testData.patientEmergency,
      allergies: testData.patientAllergies,
      medicalHistory: testData.patientHistory,
    });
    await patientProfile.save();
    console.log("3. Saved Patient profile with PHI fields.");

    // 4. Query MongoDB directly (Bypass Mongoose to check DB content)
    console.log("\n4. Verifying encrypted data in the database directly...");
    const rawPatient = await mongoose.connection.db
      .collection("patients")
      .findOne({ user: patientUser._id });

    if (!rawPatient) {
      throw new Error("Could not retrieve raw patient document from MongoDB");
    }

    console.log("--------------------------------------------------------------------------------");
    console.log("Raw Stored Patient Document (JSON representation from MongoDB):");
    console.log(JSON.stringify(rawPatient, null, 2));
    console.log("--------------------------------------------------------------------------------");

    // Perform checks
    const checkEncrypted = (fieldName, rawValue, expectedPlain) => {
      if (!rawValue) {
        throw new Error(`Field ${fieldName} is missing in DB!`);
      }
      
      if (Array.isArray(rawValue)) {
        console.log(`[CHECK] Field '${fieldName}':`);
        rawValue.forEach((item, idx) => {
          const isEnc = item.split(":").length === 3;
          console.log(`  - Element [${idx}]: Stored = "${item}" | Decrypted format valid? ${isEnc}`);
          if (!isEnc) throw new Error(`Array element at index ${idx} of ${fieldName} is not encrypted in DB!`);
        });
      } else {
        const isEnc = rawValue.split(":").length === 3;
        console.log(`[CHECK] Field '${fieldName}': Stored = "${rawValue}" | Decrypted format valid? ${isEnc}`);
        if (!isEnc) {
          throw new Error(`Field '${fieldName}' is stored in plain text in database! Value: ${rawValue}`);
        }
      }
    };

    checkEncrypted("phone", rawPatient.phone, testData.patientPhone);
    checkEncrypted("address", rawPatient.address, testData.patientAddress);
    checkEncrypted("dateOfBirth", rawPatient.dateOfBirth, testData.patientDOB);
    checkEncrypted("emergencyContact", rawPatient.emergencyContact, testData.patientEmergency);
    checkEncrypted("allergies", rawPatient.allergies, testData.patientAllergies);
    checkEncrypted("medicalHistory", rawPatient.medicalHistory, testData.patientHistory);

    console.log("✔ SUCCESS: All PHI fields in Patient document are encrypted in the database.");

    // 5. Query via Mongoose (Triggers automatic decryption hooks)
    console.log("\n5. Verifying automatic decryption via Mongoose models...");
    const mongoosePatient = await Patient.findById(patientProfile._id);

    const checkDecrypted = (fieldName, actualValue, expectedValue) => {
      const match = JSON.stringify(actualValue) === JSON.stringify(expectedValue);
      console.log(`[CHECK] Field '${fieldName}': Mongoose returned = "${JSON.stringify(actualValue)}" | Match original? ${match}`);
      if (!match) {
        throw new Error(`Mongoose failed to decrypt field ${fieldName}! Expected: ${JSON.stringify(expectedValue)}, got: ${JSON.stringify(actualValue)}`);
      }
    };

    checkDecrypted("phone", mongoosePatient.phone, testData.patientPhone);
    checkDecrypted("address", mongoosePatient.address, testData.patientAddress);
    checkDecrypted("dateOfBirth", mongoosePatient.dateOfBirth, testData.patientDOB);
    checkDecrypted("emergencyContact", mongoosePatient.emergencyContact, testData.patientEmergency);
    checkDecrypted("allergies", mongoosePatient.allergies, testData.patientAllergies);
    checkDecrypted("medicalHistory", mongoosePatient.medicalHistory, testData.patientHistory);

    console.log("✔ SUCCESS: All Patient PHI fields are decrypted correctly on model retrieval.");

    // 6. Test MedicalRecord and Prescription
    console.log("\n6. Creating MedicalRecord and Prescription...");
    const medicalRecord = new MedicalRecord({
      patient: patientProfile._id,
      doctor: doctorProfile._id,
      diagnosis: testData.diagnosis,
      symptoms: testData.symptoms,
      notes: testData.notes,
    });
    await medicalRecord.save();

    const prescription = new Prescription({
      medicalRecord: medicalRecord._id,
      medicines: [
        {
          name: "Amoxicillin",
          dosage: "500mg",
          frequency: "Three times daily",
          duration: "7 days",
        },
      ],
      instructions: "Take with food.",
    });
    await prescription.save();
    console.log("Created MedicalRecord & Prescription.");

    // 7. Verify MedicalRecord Encrypted in DB & Decrypted in Mongoose
    console.log("\n7. Verifying MedicalRecord encryption in database...");
    const rawRecord = await mongoose.connection.db
      .collection("medicalrecords")
      .findOne({ _id: medicalRecord._id });

    checkEncrypted("diagnosis", rawRecord.diagnosis, testData.diagnosis);
    checkEncrypted("symptoms", rawRecord.symptoms, testData.symptoms);
    checkEncrypted("notes", rawRecord.notes, testData.notes);
    console.log("✔ SUCCESS: MedicalRecord fields are encrypted in DB.");

    console.log("Verifying MedicalRecord decryption via Mongoose...");
    const mongooseRecord = await MedicalRecord.findById(medicalRecord._id);
    checkDecrypted("diagnosis", mongooseRecord.diagnosis, testData.diagnosis);
    checkDecrypted("symptoms", mongooseRecord.symptoms, testData.symptoms);
    checkDecrypted("notes", mongooseRecord.notes, testData.notes);
    console.log("✔ SUCCESS: MedicalRecord decrypted correctly.");

    // 8. Verify Prescription Encrypted in DB & Decrypted in Mongoose
    console.log("\n8. Verifying Prescription encryption in database...");
    const rawPrescription = await mongoose.connection.db
      .collection("prescriptions")
      .findOne({ _id: prescription._id });

    console.log("Raw Stored Prescription Medicines in DB:", JSON.stringify(rawPrescription.medicines, null, 2));
    const rawMed = rawPrescription.medicines[0];
    const isMedNameEnc = rawMed.name.split(":").length === 3;
    const isMedDosageEnc = rawMed.dosage.split(":").length === 3;
    console.log(`[CHECK] Medicine Name Encrypted? ${isMedNameEnc} ("${rawMed.name}")`);
    console.log(`[CHECK] Medicine Dosage Encrypted? ${isMedDosageEnc} ("${rawMed.dosage}")`);
    
    if (!isMedNameEnc || !isMedDosageEnc) {
      throw new Error("Prescription medicines fields were not encrypted in the database!");
    }
    checkEncrypted("instructions", rawPrescription.instructions, "Take with food.");
    console.log("✔ SUCCESS: Prescription fields are encrypted in DB.");

    console.log("Verifying Prescription decryption via Mongoose...");
    const mongoosePrescription = await Prescription.findById(prescription._id);
    const decryptedMed = mongoosePrescription.medicines[0];
    checkDecrypted("medicine name", decryptedMed.name, "Amoxicillin");
    checkDecrypted("medicine dosage", decryptedMed.dosage, "500mg");
    checkDecrypted("instructions", mongoosePrescription.instructions, "Take with food.");
    console.log("✔ SUCCESS: Prescription decrypted correctly.");

    // 9. Clean up test records
    console.log("\n9. Cleaning up test data...");
    await Prescription.findByIdAndDelete(prescription._id);
    await MedicalRecord.findByIdAndDelete(medicalRecord._id);
    await Patient.findByIdAndDelete(patientProfile._id);
    await Doctor.findByIdAndDelete(doctorProfile._id);
    await User.findByIdAndDelete(patientUser._id);
    await User.findByIdAndDelete(doctorUser._id);
    console.log("Cleanup complete.");

    console.log("\n========================================================");
    console.log("🎉 ALL TESTS PASSED: PHI Encryption Workflow is Verified!");
    console.log("========================================================");
    
    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ TEST FAILED:", error);
    if (mongoose.connection.readyState !== 0) {
      mongoose.connection.close();
    }
    process.exit(1);
  }
};

runTest();
