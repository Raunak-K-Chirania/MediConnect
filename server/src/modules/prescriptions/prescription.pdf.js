const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

/**
 * Helper to calculate patient's age in years
 */
const calculateAge = (dobString) => {
  if (!dobString) return "N/A";
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return "N/A";
  const diffMs = Date.now() - dob.getTime();
  const ageDate = new Date(diffMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

/**
 * Generates a professionally formatted digital prescription PDF
 * @param {Object} prescription - Decrypted prescription document
 * @param {PDFDocument} doc - PDFKit document instance
 */
const generatePrescriptionPdf = async (prescription, doc) => {
  // Extract related documents
  const patient = prescription.patientId || {};
  const patientUser = patient.user || {};
  const doctor = prescription.doctorId || {};
  const doctorUser = doctor.user || {};
  const medicalRecord = prescription.medicalRecord || {};

  const patientName = patientUser.name || "N/A";
  const patientGender = patient.gender || "N/A";
  const patientBlood = patient.bloodGroup || "N/A";
  const patientPhone = patient.phone || "N/A";
  const patientAddress = patient.address || "N/A";
  const patientDob = patient.dateOfBirth || "N/A";
  const patientAge = calculateAge(patient.dateOfBirth);

  const doctorName = doctorUser.name ? `Dr. ${doctorUser.name}` : "N/A";
  const doctorSpec = doctor.specialization || "N/A";
  const doctorQual = doctor.qualification || "N/A";
  const doctorLicense = doctor.licenseNumber || "N/A";
  const doctorHospital = doctor.hospital || "MediConnect Hospital";

  const diagnosis = medicalRecord.diagnosis || "No primary diagnosis recorded";
  const followUpDate = prescription.followUpDate
    ? new Date(prescription.followUpDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // -- Design Tokens --
  const PRIMARY_COLOR = "#1E3A8A"; // Deep Navy
  const SECONDARY_COLOR = "#3B82F6"; // Accent Blue
  const TEXT_DARK = "#1F2937"; // Charcoal
  const TEXT_MUTED = "#4B5563"; // Muted Gray
  const LIGHT_BG = "#F3F4F6"; // Light Gray Table Header
  const ROW_BG_ALT = "#F9FAFB"; // Alternating row color
  const BORDER_COLOR = "#E5E7EB"; // Thin borders

  // -- Page 1 Header --
  doc.rect(50, 40, 495, 5).fill(PRIMARY_COLOR);

  // Logo & Title
  doc.fillColor(PRIMARY_COLOR).fontSize(22).font("Helvetica-Bold").text("MediConnect Healthcare", 50, 60);
  doc.fillColor(TEXT_MUTED).fontSize(10).font("Helvetica").text("Secure Digital Prescription System", 50, 85);

  // Prescription Metadata (Right Aligned)
  doc.fillColor(TEXT_DARK).fontSize(9).font("Helvetica-Bold").text("PRESCRIPTION ID:", 350, 60, { width: 195, align: "right" });
  doc.font("Helvetica").fillColor(TEXT_MUTED).text(prescription._id.toString(), 350, 72, { width: 195, align: "right" });
  
  doc.fillColor(TEXT_DARK).font("Helvetica-Bold").text("DATE:", 350, 88, { width: 195, align: "right" });
  doc.font("Helvetica").fillColor(TEXT_MUTED).text(new Date(prescription.createdAt || Date.now()).toLocaleDateString(), 350, 100, { width: 195, align: "right" });

  // Divider
  doc.moveTo(50, 115).lineTo(545, 115).strokeColor(BORDER_COLOR).lineWidth(1).stroke();

  // -- Doctor & Patient Details (Columns) --
  // Left Column - Doctor Details
  let curY = 130;
  doc.fillColor(SECONDARY_COLOR).fontSize(10).font("Helvetica-Bold").text("DOCTOR INFORMATION", 50, curY);
  doc.fillColor(TEXT_DARK).fontSize(11).font("Helvetica-Bold").text(doctorName, 50, curY + 15);
  doc.fillColor(TEXT_MUTED).fontSize(9).font("Helvetica")
    .text(`Specialization: ${doctorSpec}`, 50, curY + 30)
    .text(`Qualification: ${doctorQual}`, 50, curY + 42)
    .text(`License No: ${doctorLicense}`, 50, curY + 54)
    .text(`Hospital/Clinic: ${doctorHospital}`, 50, curY + 66);

  // Right Column - Patient Details
  doc.fillColor(SECONDARY_COLOR).fontSize(10).font("Helvetica-Bold").text("PATIENT INFORMATION", 320, curY);
  doc.fillColor(TEXT_DARK).fontSize(11).font("Helvetica-Bold").text(patientName, 320, curY + 15);
  doc.fillColor(TEXT_MUTED).fontSize(9).font("Helvetica")
    .text(`Age / DOB: ${patientAge} Years (DOB: ${patientDob})`, 320, curY + 30)
    .text(`Gender: ${patientGender}  |  Blood Group: ${patientBlood}`, 320, curY + 42)
    .text(`Phone: ${patientPhone}`, 320, curY + 54)
    .text(`Address: ${patientAddress}`, 320, curY + 66, { width: 225 });

  // Divider
  doc.moveTo(50, 220).lineTo(545, 220).strokeColor(BORDER_COLOR).lineWidth(1).stroke();

  // -- Diagnosis Section --
  curY = 235;
  doc.fillColor(PRIMARY_COLOR).fontSize(10).font("Helvetica-Bold").text("DIAGNOSIS / CLINICAL FINDINGS", 50, curY);
  doc.fillColor(TEXT_DARK).fontSize(9).font("Helvetica").text(diagnosis, 50, curY + 15, { width: 495 });

  // Divider
  doc.moveTo(50, 275).lineTo(545, 275).strokeColor(BORDER_COLOR).lineWidth(1).stroke();

  // -- RX / Medications Section --
  curY = 290;
  doc.fillColor(PRIMARY_COLOR).fontSize(18).font("Helvetica-Bold").text("Rx", 50, curY);
  
  // Table Header
  const tableTop = curY + 25;
  doc.rect(50, tableTop, 495, 20).fill(PRIMARY_COLOR);
  doc.fillColor("#FFFFFF").fontSize(9).font("Helvetica-Bold")
    .text("Medicine Name", 55, tableTop + 5)
    .text("Dosage", 250, tableTop + 5)
    .text("Frequency", 340, tableTop + 5)
    .text("Duration", 450, tableTop + 5);

  let rowY = tableTop + 20;
  const medicines = prescription.medicines || [];

  medicines.forEach((med, index) => {
    // Alternating rows background
    if (index % 2 === 1) {
      doc.rect(50, rowY, 495, 22).fill(ROW_BG_ALT);
    }
    
    doc.fillColor(TEXT_DARK).fontSize(9).font("Helvetica")
      .text(med.name, 55, rowY + 6, { width: 190 })
      .text(med.dosage, 250, rowY + 6, { width: 85 })
      .text(med.frequency || "-", 340, rowY + 6, { width: 105 })
      .text(med.duration || "-", 450, rowY + 6, { width: 90 });

    rowY += 22;
  });

  // Border bottom for the table
  doc.moveTo(50, rowY).lineTo(545, rowY).strokeColor(PRIMARY_COLOR).lineWidth(1).stroke();

  // -- Instructions --
  curY = rowY + 15;
  doc.fillColor(PRIMARY_COLOR).fontSize(10).font("Helvetica-Bold").text("ADDITIONAL INSTRUCTIONS", 50, curY);
  doc.fillColor(TEXT_DARK).fontSize(9).font("Helvetica").text(prescription.instructions || "Take all medicines as directed.", 50, curY + 15, { width: 495 });

  // -- Follow-Up Date --
  if (followUpDate) {
    curY = curY + 50;
    doc.fillColor(PRIMARY_COLOR).fontSize(10).font("Helvetica-Bold").text("RECOMMENDED FOLLOW-UP DATE", 50, curY);
    doc.fillColor(TEXT_DARK).fontSize(10).font("Helvetica-Bold").text(followUpDate, 50, curY + 15);
  }

  // -- Signature & Footer --
  // -- QR Code Generation and Embedding --
  const verificationUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/verify-prescription/${prescription._id}`;
  let qrBuffer = null;
  try {
    const QRCode = require("qrcode"); // require again just in case, though it is imported at top
    // Generate QR code synchronously from callback is not possible but we can await it because we made this function async!
    qrBuffer = await QRCode.toBuffer(verificationUrl, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 100,
    });
  } catch (err) {
    console.error("Failed to generate prescription verification QR code:", err);
  }

  if (qrBuffer) {
    // Embed the QR Code
    doc.image(qrBuffer, 50, 660, { width: 80 });

    // Label beside the QR Code
    doc.fillColor(TEXT_MUTED).fontSize(7).font("Helvetica-Bold").text("PRESCRIPTION VERIFICATION", 140, 675);
    doc.font("Helvetica").fontSize(6.5).text(
      "Scan this QR code or visit the verification portal to verify the authenticity of this digital prescription. Any mismatch indicates a tampered or invalid prescription.",
      140,
      687,
      { width: 200 }
    );
    doc.fillColor(PRIMARY_COLOR).fontSize(6.5).font("Helvetica-Bold").text(
      `Secure Hash: ${prescription.hash ? prescription.hash.substring(0, 32) + "..." : "N/A"}`,
      140,
      715
    );
  }

  // Signature Box
  doc.moveTo(370, 720).lineTo(520, 720).strokeColor(BORDER_COLOR).lineWidth(1).stroke();
  doc.fillColor(TEXT_MUTED).fontSize(8).font("Helvetica-Bold").text("Digitally Signed by Prescriber", 370, 725, { width: 150, align: "center" });
  doc.font("Helvetica").fontSize(7).text(`License Ref: ${doctorLicense}`, 370, 735, { width: 150, align: "center" });

  // Bottom Security Line
  doc.rect(50, 770, 495, 30).fill(LIGHT_BG);
  doc.fillColor(TEXT_MUTED).fontSize(7).font("Helvetica-Oblique").text(
    "This digital prescription is electronically signed, verified, and secured under HIPAA standards. The authenticity of this document can be verified against the MediConnect medical records ledger.",
    60,
    776,
    { width: 475, align: "center" }
  );

  doc.end();
};

module.exports = {
  generatePrescriptionPdf,
};
