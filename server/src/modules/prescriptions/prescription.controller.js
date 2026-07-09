const prescriptionService = require("./prescription.service");
const { successResponse } = require("../../utils/apiResponse");
const PDFDocument = require("pdfkit");
const { generatePrescriptionPdf } = require("./prescription.pdf");

/**
 * Controller to handle digital prescription creation.
 */
const createPrescription = async (req, res, next) => {
  try {
    const prescription = await prescriptionService.createPrescription(req.body, req.user);

    // Set rich audit logging context for middleware
    req.auditLogData = {
      action: "PRESCRIPTION_CREATED",
      resourceType: "Prescription",
      resourceId: prescription._id,
    };

    return successResponse(res, 201, "Prescription created successfully", prescription);
  } catch (error) {
    return next(error);
  }
};

/**
 * Controller to handle retrieving details of a single digital prescription.
 */
const getPrescription = async (req, res, next) => {
  try {
    const prescription = await prescriptionService.getPrescriptionById(req.params.id, req.user);

    // Set rich audit logging context for middleware
    req.auditLogData = {
      action: "PRESCRIPTION_VIEWED",
      resourceType: "Prescription",
      resourceId: prescription._id,
    };

    return successResponse(res, 200, "Prescription details retrieved successfully", prescription);
  } catch (error) {
    return next(error);
  }
};

/**
 * Controller to retrieve all prescriptions of a patient.
 */
const getPatientPrescriptions = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const prescriptions = await prescriptionService.getPatientPrescriptions(patientId, req.user);

    // Set rich audit logging context for middleware
    req.auditLogData = {
      action: "PRESCRIPTION_LIST_VIEWED",
      resourceType: "Prescription",
    };

    return successResponse(res, 200, "Patient prescriptions retrieved successfully", prescriptions);
  } catch (error) {
    return next(error);
  }
};

/**
 * Controller to generate and stream the prescription PDF download.
 */
const downloadPdf = async (req, res, next) => {
  try {
    // 1. Fetch prescription (this handles RBAC checks and encryption decryption)
    const prescription = await prescriptionService.getPrescriptionById(req.params.id, req.user);

    // 2. Set rich audit logging context
    req.auditLogData = {
      action: "PRESCRIPTION_PDF_DOWNLOADED",
      resourceType: "Prescription",
      resourceId: prescription._id,
    };

    // 3. Setup PDFKit document
    const doc = new PDFDocument({ margin: 50, size: "A4" });

    // 4. Set headers for attachment download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="prescription-${prescription._id}.pdf"`
    );

    // 5. Pipe PDF document straight to response stream
    doc.pipe(res);

    // 6. Generate content (this calls doc.end() when complete)
    generatePrescriptionPdf(prescription, doc);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createPrescription,
  getPrescription,
  getPatientPrescriptions,
  downloadPdf,
};
