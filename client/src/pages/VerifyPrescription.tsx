import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosInstance from '../api/axios';
import { 
  ShieldCheck, ShieldAlert, AlertTriangle, Calendar, User, 
  Stethoscope, Activity, FileText, ArrowLeft, HeartPulse, RefreshCw
} from 'lucide-react';

interface VerificationResult {
  valid: boolean;
  tampered: boolean;
  message: string;
  prescription?: {
    _id: string;
    patient?: {
      name: string;
      gender: string;
      dateOfBirth: string;
    };
    doctor?: {
      name: string;
      specialization: string;
      licenseNumber: string;
      hospital: string;
    };
    medicines?: Array<{
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
    }>;
    instructions?: string;
    followUpDate?: string | null;
    createdAt: string;
    // For tampered payload fallback
    patientName?: string;
    doctorName?: string;
    date?: string;
  };
}

export const VerifyPrescription: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchVerification = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axiosInstance.get(`/prescriptions/${id}/verify`);
      if (response.data && response.data.success) {
        setResult(response.data.data);
      } else {
        setError('Verification response format was invalid.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'A network error occurred while connecting to the verification ledger.');
    } finally {
      // Add a slight delay for the scanning simulation (makes it feel premium and functional)
      setTimeout(() => {
        setLoading(false);
      }, 1500);
    }
  };

  useEffect(() => {
    if (id) {
      fetchVerification();
    }
  }, [id]);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background elements */}
      <div className="absolute top-0 left-0 right-0 h-80 bg-gradient-to-b from-indigo-50 to-transparent pointer-events-none -z-10" />

      <div className="max-w-2xl w-full">
        {/* Logo and header */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-indigo-650 p-2 rounded-2xl text-white shadow-lg shadow-indigo-650/20">
              <HeartPulse className="w-6 h-6 animate-pulse" />
            </div>
            <span className="text-xl font-black text-slate-800 tracking-tight">
              MediConnect <span className="text-indigo-650 font-bold">Secure</span>
            </span>
          </div>
          <p className="text-slate-400 text-xs tracking-wider uppercase font-semibold">
            Prescription Ledger Verification
          </p>
        </div>

        {/* Card Panel */}
        <div className="bg-white border border-slate-200/80 rounded-[2.5rem] p-6 sm:p-8 shadow-xl shadow-slate-100/70 overflow-hidden relative">
          
          {/* 1. LOADING & SCANNING SIMULATION */}
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center space-y-6">
              <div className="relative flex items-center justify-center">
                {/* Scanner pulse circle */}
                <div className="absolute inset-0 rounded-full bg-indigo-100/60 animate-ping scale-150 opacity-75" />
                <div className="bg-indigo-50 p-7 rounded-[2rem] border border-indigo-100 text-indigo-650 relative shadow-inner">
                  <RefreshCw className="w-10 h-10 animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold text-slate-800">Verifying Cryptographic Ledger</h3>
                <p className="text-slate-400 text-xs mt-1 max-w-xs leading-relaxed">
                  Checking document HMAC signature against the secure medical records blockchain...
                </p>
              </div>
            </div>
          )}

          {/* 2. ERROR STATE (NETWORK/SERVER FAILURE) */}
          {!loading && error && (
            <div className="py-6 flex flex-col items-center text-center space-y-5">
              <div className="bg-red-50 p-4 rounded-2xl border border-red-150 text-red-650">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Verification Interrupted</h3>
                <p className="text-red-500 text-xs mt-1.5 leading-relaxed bg-red-50/50 px-3 py-2 border border-red-100 rounded-xl max-w-md">
                  {error}
                </p>
              </div>
              <button 
                onClick={fetchVerification}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-650 hover:bg-indigo-700 rounded-xl transition shadow-md shadow-indigo-650/10 active:scale-95"
              >
                Retry Request
              </button>
            </div>
          )}

          {/* 3. SUCCESS STATE - AUTHENTIC RECORD */}
          {!loading && !error && result && result.valid && result.prescription && (
            <div className="space-y-6">
              {/* Success Badge Banner */}
              <div className="bg-emerald-50 border border-emerald-150 rounded-2xl p-4 flex items-start gap-4">
                <div className="bg-emerald-500 p-2.5 rounded-xl text-white shadow-md shadow-emerald-500/20">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                    Verified Authentic
                  </span>
                  <h3 className="text-sm font-bold text-slate-800 mt-1 leading-snug">
                    Integrity Confirmed
                  </h3>
                  <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                    This digital prescription matches the official signed electronic health records exactly. No modifications detected.
                  </p>
                </div>
              </div>

              {/* Prescription Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                    Prescription ID
                  </span>
                  <code className="text-slate-800 font-mono text-[11px] bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
                    {result.prescription._id}
                  </code>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                    Date Issued
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-slate-800 font-semibold">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{formatDate(result.prescription.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Doctor & Patient Sections */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Doctor Details */}
                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200/50">
                    <Stethoscope className="w-4 h-4 text-indigo-500" />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Prescribing Doctor
                    </h4>
                  </div>
                  <div className="text-xs space-y-1.5 text-slate-600">
                    <p className="font-bold text-slate-800 text-sm">
                      {result.prescription.doctor?.name}
                    </p>
                    <p>{result.prescription.doctor?.specialization}</p>
                    <p>License: <span className="font-semibold text-slate-800">{result.prescription.doctor?.licenseNumber}</span></p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {result.prescription.doctor?.hospital}
                    </p>
                  </div>
                </div>

                {/* Patient Details */}
                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200/50">
                    <User className="w-4 h-4 text-indigo-500" />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Patient Details
                    </h4>
                  </div>
                  <div className="text-xs space-y-1.5 text-slate-600">
                    <p className="font-bold text-slate-800 text-sm">
                      {result.prescription.patient?.name}
                    </p>
                    <p>DOB: <span className="font-semibold text-slate-800">{formatDate(result.prescription.patient?.dateOfBirth)}</span></p>
                    <p>Gender: <span className="font-semibold text-slate-800">{result.prescription.patient?.gender}</span></p>
                  </div>
                </div>
              </div>

              {/* Medicines Rx list */}
              <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-indigo-50/50 border-b border-slate-100 px-4 py-2.5 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-500" />
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Prescribed Medications (Rx)
                  </h4>
                </div>
                <table className="w-full text-xs text-left text-slate-600">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-widest text-[9px]">
                      <th className="px-4 py-2">Medicine</th>
                      <th className="py-2">Dosage</th>
                      <th className="py-2">Frequency</th>
                      <th className="px-4 py-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.prescription.medicines?.map((med, idx) => (
                      <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/40">
                        <td className="px-4 py-2.5 font-bold text-slate-800">{med.name}</td>
                        <td className="py-2.5">{med.dosage}</td>
                        <td className="py-2.5">{med.frequency}</td>
                        <td className="px-4 py-2.5">{med.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Additional Details */}
              <div className="space-y-4 pt-2">
                {result.prescription.instructions && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Doctor Instructions
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 bg-slate-50/80 p-3 rounded-xl border border-slate-200/50 leading-relaxed italic whitespace-pre-wrap">
                      "{result.prescription.instructions}"
                    </p>
                  </div>
                )}

                {result.prescription.followUpDate && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      Follow-up Date:
                    </span>
                    <span className="font-bold text-indigo-650 bg-indigo-50 border border-indigo-100/70 px-2.5 py-0.5 rounded-lg">
                      {formatDate(result.prescription.followUpDate)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. TAMPERED WARNING STATE */}
          {!loading && !error && result && !result.valid && result.tampered && (
            <div className="space-y-6">
              {/* Alert Box Banner */}
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-4 shadow-sm shadow-red-100">
                <div className="bg-red-500 p-2.5 rounded-xl text-white shadow-md shadow-red-500/25 animate-bounce">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <span className="bg-red-100 text-red-800 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                    TAMPER DETECTED
                  </span>
                  <h3 className="text-sm font-bold text-slate-800 mt-1 leading-snug">
                    Security Integrity Failure
                  </h3>
                  <p className="text-slate-600 text-[11px] mt-1 leading-relaxed">
                    The cryptographic verification signature of this document does not match the record signature in the database. This prescription has been altered after issue or is a counterfeit copy.
                  </p>
                </div>
              </div>

              {/* Record mismatch highlights */}
              <div className="border border-red-100 bg-red-50/30 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-red-800 uppercase tracking-wide flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Mismatched Record Reference
                </h4>
                {result.prescription ? (
                  <div className="text-xs space-y-1 text-slate-600">
                    <p>Prescription Ref ID: <code className="font-mono text-[10px] bg-white border border-red-100 px-1 py-0.5 rounded">{result.prescription._id}</code></p>
                    <p>Associated Doctor: <strong className="text-slate-800">{result.prescription.doctorName}</strong></p>
                    <p>Associated Patient: <strong className="text-slate-800">{result.prescription.patientName}</strong></p>
                    <p>Creation Date: <span className="font-semibold">{formatDate(result.prescription.date)}</span></p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No original document references could be retrieved safely.</p>
                )}
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] text-slate-400 text-center leading-relaxed">
                CAUTION: Pharmacists are advised NOT to dispense any medications based on this document. Please contact the clinic or doctor directly to issue a verified prescription.
              </div>
            </div>
          )}

          {/* 5. NOT FOUND WARNING STATE */}
          {!loading && !error && result && !result.valid && !result.tampered && (
            <div className="py-8 flex flex-col items-center justify-center space-y-6">
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-150 text-amber-500">
                <AlertTriangle className="w-10 h-10" />
              </div>
              <div className="text-center space-y-1.5 max-w-sm">
                <h3 className="text-base font-bold text-slate-800">Prescription Not Found</h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  We could not find any digital prescription matching the provided reference ID in the database.
                </p>
              </div>
              <div className="p-3.5 bg-amber-50/50 border border-amber-100/60 rounded-xl font-mono text-[10px] text-amber-800">
                Ref ID: {id}
              </div>
              <p className="text-[10px] text-slate-400 text-center leading-relaxed max-w-xs">
                Ensure that you scanned the correct barcode/QR code from an official prescription issued by a MediConnect healthcare provider.
              </p>
            </div>
          )}

        </div>

        {/* Back Link */}
        <div className="flex justify-center mt-6">
          <Link 
            to="/login"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 font-bold transition-all py-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Dashboard Login
          </Link>
        </div>

      </div>
    </div>
  );
};

export default VerifyPrescription;
