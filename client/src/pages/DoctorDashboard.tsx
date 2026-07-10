import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../store/authStore';
import { appointmentService, Appointment } from '../services/appointmentService';
import { medicalRecordService, MedicalRecord } from '../services/medicalRecordService';
import { clinicalNoteService, ClinicalNote } from '../services/clinicalNoteService';
import { patientService, PatientProfile } from '../services/patientService';
import DashboardLayout from '../layouts/DashboardLayout';
import { clinicalNoteSchema, medicalRecordSchema } from '../schemas/validationSchemas';
import { 
  Calendar, FileText, Search, Clock, 
  AlertCircle, CheckCircle2, User, Stethoscope, 
  Activity, Clipboard, Eye, X, Check, Trash2, Edit2, Plus, RefreshCw, Video, Download
} from 'lucide-react';

export const DoctorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('summary');

  // Core Data States
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Success / Info notifications
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  // Rejection Dialog State
  const [rejectingAppt, setRejectingAppt] = useState<Appointment | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Active Patient Session for SOAP Note / EHR Record
  const [activePatient, setActivePatient] = useState<PatientProfile | null>(null);
  const [activePatientHistory, setActivePatientHistory] = useState<MedicalRecord[]>([]);
  const [activePatientNotes, setActivePatientNotes] = useState<ClinicalNote[]>([]);
  const [loadingPatientData, setLoadingPatientData] = useState(false);

  // SOAP Note Modals
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ClinicalNote | null>(null);
  const [activeApptId, setActiveApptId] = useState<string>('');

  // EHR Record Modal
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  // Filtering states
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [apptFilter, setApptFilter] = useState<'all' | 'pending' | 'approved' | 'completed'>('all');

  const sidebarItems = [
    { label: 'Overview', value: 'summary', icon: Activity },
    { label: 'Schedule', value: 'schedule', icon: Calendar },
    { label: 'Patients Directory', value: 'patients', icon: User },
  ];

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const apptsRes = await appointmentService.getByDoctor(user.id);
      setAppointments(apptsRes.data || []);

      const patientsRes = await patientService.listAll();
      setPatients(patientsRes.patients || []);

      setError(null);
    } catch (err: any) {
      console.error('Error fetching doctor console details:', err);
      setError('Could not fetch doctor records. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleDownloadPrescription = async (prescriptionId: string) => {
    setDownloadingPdfId(prescriptionId);
    try {
      const blob = await medicalRecordService.downloadPrescriptionPdf(prescriptionId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `prescription-${prescriptionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('Prescription PDF downloaded successfully.', 'success');
    } catch (err) {
      console.error('Failed to download PDF:', err);
      showToast('Failed to download prescription PDF. Please try again.', 'error');
    } finally {
      setDownloadingPdfId(null);
    }
  };

  // Actions for Appointments
  const handleApprove = async (id: string) => {
    try {
      await appointmentService.approve(id);
      showToast('Appointment approved successfully!');
      loadData();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to approve appointment.', 'error');
    }
  };

  const handleReject = async () => {
    if (!rejectingAppt) return;
    if (!rejectionReason.trim()) {
      showToast('Please provide a rejection reason', 'error');
      return;
    }
    try {
      await appointmentService.reject(rejectingAppt._id, rejectionReason);
      showToast('Appointment rejected successfully');
      setRejectingAppt(null);
      setRejectionReason('');
      loadData();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Rejection failed', 'error');
    }
  };

  const handleComplete = async (appt: Appointment) => {
    try {
      await appointmentService.complete(appt._id);
      showToast('Appointment marked as Completed.');
      loadData();
      
      const patientId = typeof appt.patientId === 'object' ? appt.patientId._id : appt.patientId;
      const patientProfile = patients.find(p => p._id === patientId || p.user?.id === patientId || (p.user as any)?._id === patientId);
      if (patientProfile) {
        handleSelectPatient(patientProfile);
        setActiveApptId(appt._id);
        showToast('You can now create clinical SOAP notes or prescriptions for this patient.');
      }
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to complete appointment', 'error');
    }
  };

  const handleSelectPatient = async (patient: PatientProfile) => {
    setActivePatient(patient);
    setLoadingPatientData(true);
    setActiveTab('patients');
    try {
      const historyRes = await medicalRecordService.getByPatient(patient._id);
      setActivePatientHistory(historyRes.data?.records || []);

      const notesRes = await clinicalNoteService.getByPatient(patient._id);
      setActivePatientNotes(notesRes || []);
    } catch (err) {
      showToast('Error loading patient EHR history. Check assignment constraints.', 'error');
    } finally {
      setLoadingPatientData(false);
    }
  };

  // SOAP Note Form setup
  const {
    register: registerNote,
    handleSubmit: handleSubmitNote,
    setValue: setValueNote,
    reset: resetNote,
    formState: { errors: errorsNote }
  } = useForm({
    resolver: zodResolver(clinicalNoteSchema),
    defaultValues: {
      subjectiveFindings: '',
      objectiveFindings: '',
      assessment: '',
      plan: '',
      consultationDate: new Date().toISOString().split('T')[0],
    }
  });

  const onNoteSubmit = async (data: any) => {
    if (!activePatient || !user) return;
    try {
      if (editingNote) {
        await clinicalNoteService.update(editingNote._id, data);
        showToast('Clinical SOAP Note updated successfully!');
      } else {
        const payload = {
          appointmentId: activeApptId || appointments.find(a => {
            const pId = typeof a.patientId === 'object' ? a.patientId._id : a.patientId;
            return pId === activePatient._id && a.status === 'completed';
          })?._id || appointments[0]?._id,
          patientId: activePatient._id,
          doctorId: user.id,
          ...data,
        };
        if (!payload.appointmentId) {
          showToast('Cannot create clinical note. No appointment history found.', 'error');
          return;
        }
        await clinicalNoteService.create(payload);
        showToast('Clinical SOAP Note saved successfully!');
      }

      setIsNoteModalOpen(false);
      setEditingNote(null);
      resetNote();
      
      handleSelectPatient(activePatient);
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to save clinical note', 'error');
    }
  };

  const handleEditNote = (note: ClinicalNote) => {
    setEditingNote(note);
    setValueNote('subjectiveFindings', note.subjectiveFindings);
    setValueNote('objectiveFindings', note.objectiveFindings);
    setValueNote('assessment', note.assessment);
    setValueNote('plan', note.plan);
    setValueNote('consultationDate', new Date(note.consultationDate).toISOString().split('T')[0]);
    setIsNoteModalOpen(true);
  };

  const handleDeleteNote = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this clinical note?')) return;
    try {
      await clinicalNoteService.delete(id);
      showToast('Clinical note deleted');
      if (activePatient) handleSelectPatient(activePatient);
    } catch {
      showToast('Error deleting clinical note', 'error');
    }
  };

  // EHR Record Form setup
  const {
    register: registerRecord,
    handleSubmit: handleSubmitRecord,
    control: controlRecord,
    reset: resetRecord,
    formState: { errors: errorsRecord }
  } = useForm<any>({
    resolver: zodResolver(medicalRecordSchema),
    defaultValues: {
      diagnosis: '',
      symptoms: '',
      treatmentPlan: '',
      medications: '',
      allergies: '',
      notes: '',
      visitDate: new Date().toISOString().split('T')[0],
      medicines: [] as any[],
      instructions: '',
    }
  });

  const { fields: medicineFields, append: appendMedicine, remove: removeMedicine } = useFieldArray({
    control: controlRecord,
    name: 'medicines' as any
  });

  const onRecordSubmit = async (data: any) => {
    if (!activePatient || !user) return;
    try {
      const rx = data.medicines && data.medicines.length > 0 ? {
        medicines: data.medicines,
        instructions: data.instructions,
      } : undefined;

      const payload = {
        patientId: activePatient._id,
        diagnosis: data.diagnosis,
        symptoms: data.symptoms,
        treatmentPlan: data.treatmentPlan,
        medications: data.medications,
        allergies: data.allergies ? data.allergies.split(',').map((s: string) => s.trim()) : [],
        notes: data.notes,
        visitDate: data.visitDate,
        prescription: rx,
      };

      await medicalRecordService.create(payload);
      showToast('EHR Medical Record and Prescription created successfully!');
      setIsRecordModalOpen(false);
      resetRecord();

      handleSelectPatient(activePatient);
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'EHR Creation forbidden. Ensure you are the assigned doctor for this patient.', 'error');
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  };

  const getPatientName = (appt: Appointment) => {
    if (typeof appt.patientId === 'object') {
      return appt.patientId?.user?.name || appt.patientId?.name || 'Patient';
    }
    const match = patients.find(p => p._id === appt.patientId);
    return match?.user?.name || 'Patient Profile';
  };

  const getDoctorName = (doc: any) => {
    if (!doc) return 'Practitioner';
    if (typeof doc === 'object') {
      return doc.user?.name ? `Dr. ${doc.user.name}` : (doc.name ? `Dr. ${doc.name}` : 'Doctor Profile');
    }
    if (user && doc === user.id) return `Dr. ${user.name}`;
    return 'Dr. Practitioner';
  };

  // Filtering
  const filteredAppts = appointments.filter((appt) => {
    if (apptFilter === 'all') return true;
    return appt.status.toLowerCase() === apptFilter.toLowerCase();
  });

  const filteredPatients = patients.filter((pat) => {
    const term = patientSearchQuery.toLowerCase();
    const name = pat.user?.name?.toLowerCase() || '';
    const email = pat.user?.email?.toLowerCase() || '';
    const phone = pat.phone?.toLowerCase() || '';
    return name.includes(term) || email.includes(term) || phone.includes(term);
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'completed':
        return 'bg-emerald-50 border-emerald-200 text-emerald-600';
      case 'rejected':
      case 'cancelled':
        return 'bg-rose-50 border-rose-200 text-rose-600';
      default:
        return 'bg-amber-50 border-amber-200 text-amber-600';
    }
  };

  return (
    <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab} sidebarItems={sidebarItems}>
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-5 right-5 z-55 p-4 border rounded-2xl flex items-center gap-3 backdrop-blur-md shadow-2xl animate-slideIn ${
          toast.type === 'success' ? 'bg-teal-50 border-teal-500 text-teal-800' : 'bg-rose-50 border-rose-500 text-rose-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-teal-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[350px]">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-550 text-xs">Loading Doctor Clinical Console...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-4 max-w-2xl mx-auto my-6 text-rose-850">
          <AlertCircle className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-base text-slate-800">Database Sync Error</h3>
            <p className="text-xs mt-1 text-slate-650">{error}</p>
            <button onClick={loadData} className="mt-4 px-4 py-2 bg-white border border-slate-300 text-xs rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50">
              <RefreshCw className="w-3.5 h-3.5" /> Retry Connection
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* TAB 1: SUMMARY OVERVIEW */}
          {activeTab === 'summary' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                <h1 className="text-2xl font-black text-slate-800">Welcome back, Dr. {user?.name}!</h1>
                <p className="text-slate-500 text-xs mt-1">Clinical Dashboard. Approve patient booking requests, review consult schedulers, or edit soap files.</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                  <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Today's Appointments</span>
                    <span className="text-2xl font-black text-slate-800 mt-0.5 block">
                      {appointments.filter(a => a.status === 'approved').length}
                    </span>
                  </div>
                  <div className="p-4 bg-teal-50 border border-teal-150 rounded-2xl">
                    <span className="text-[10px] text-teal-500 font-bold uppercase tracking-wider block">Pending Approvals</span>
                    <span className="text-2xl font-black text-slate-800 mt-0.5 block">
                      {appointments.filter(a => a.status === 'pending').length}
                    </span>
                  </div>
                  <div className="p-4 bg-indigo-50 border border-indigo-150 rounded-2xl">
                    <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider block">Registered Patients</span>
                    <span className="text-2xl font-black text-slate-800 mt-0.5 block">{patients.length}</span>
                  </div>
                </div>
              </div>

              {/* Grid: Pending Approvals & Today's Schedule */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Pending Bookings */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col min-h-[220px]">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <Clock className="w-4.5 h-4.5 text-teal-500" />
                      <span>Pending Booking Requests</span>
                    </h2>
                    <button onClick={() => { setActiveTab('schedule'); setApptFilter('pending'); }} className="text-xs font-bold text-teal-650 hover:underline">View All</button>
                  </div>

                  <div className="flex-1 space-y-3">
                    {appointments.filter(a => a.status === 'pending').slice(0, 3).length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center p-4 text-center text-slate-400">
                        <Check className="w-8 h-8 mb-2 text-teal-500 stroke-1" />
                        <p className="text-xs">All booking requests approved!</p>
                      </div>
                    ) : (
                      appointments.filter(a => a.status === 'pending').slice(0, 3).map((appt) => (
                        <div key={appt._id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-800">{getPatientName(appt)}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{formatDate(appt.appointmentDate)} @ {appt.startTime}</p>
                          </div>
                          <div className="flex gap-2.5">
                            <button
                              onClick={() => handleApprove(appt._id)}
                              className="p-1.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg text-emerald-600 transition-colors"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setRejectingAppt(appt)}
                              className="p-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg text-rose-600 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right: Confirmed timeline */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col min-h-[220px]">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <Calendar className="w-4.5 h-4.5 text-indigo-500" />
                      <span>Today's Consultation Schedule</span>
                    </h2>
                    <button onClick={() => { setActiveTab('schedule'); setApptFilter('approved'); }} className="text-xs font-bold text-indigo-650 hover:underline">View All</button>
                  </div>

                  <div className="flex-1 space-y-3">
                    {appointments.filter(a => a.status === 'approved').slice(0, 3).length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center p-4 text-center text-slate-400">
                        <Clock className="w-8 h-8 mb-2 stroke-1 text-slate-300" />
                        <p className="text-xs">No consultations scheduled for today.</p>
                      </div>
                    ) : (
                      appointments.filter(a => a.status === 'approved').slice(0, 3).map((appt) => (
                        <div key={appt._id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-800">{getPatientName(appt)}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-indigo-500" /> {appt.startTime} - {appt.endTime}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {appt.appointmentType === 'Online Video Consult' && (
                              <button
                                onClick={() => navigate(`/video-call/${appt._id}`)}
                                className="px-2.5 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Video className="w-3 h-3" />
                                Call
                              </button>
                            )}
                            <button
                              onClick={() => handleComplete(appt)}
                              className="px-2.5 py-1 text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors cursor-pointer"
                            >
                              Complete
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SCHEDULE MANAGEMENT */}
          {activeTab === 'schedule' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-xl font-black text-slate-800">Clinical Consultation Schedule</h1>
                  <p className="text-slate-500 text-xs mt-0.5">Manage schedule, review details, or issue medical records.</p>
                </div>

                <div className="flex gap-2">
                  {(['all', 'pending', 'approved', 'completed'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setApptFilter(filter)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer capitalize ${
                        apptFilter === filter
                          ? 'bg-teal-50 border-teal-200 text-teal-600'
                          : 'bg-white border-slate-200 hover:border-slate-350 text-slate-500'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Consultation grid list */}
              {filteredAppts.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 max-w-xl mx-auto">
                  <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3 stroke-1" />
                  <h3 className="font-bold text-slate-800 text-base">No appointments</h3>
                  <p className="text-slate-500 text-xs mt-1">There are no patient bookings matching the selected criteria.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredAppts.map((appt) => (
                    <div key={appt._id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">{appt.appointmentType}</span>
                            <h3 className="text-base font-black text-slate-800 mt-0.5">{getPatientName(appt)}</h3>
                          </div>
                          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase border rounded-full ${getStatusBadgeClass(appt.status)}`}>
                            {appt.status}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs text-slate-500 mb-4">
                          <p><strong>Date:</strong> {formatDate(appt.appointmentDate)}</p>
                          <p><strong>Hours:</strong> {appt.startTime} - {appt.endTime}</p>
                          <p><strong>Reason:</strong> {appt.reasonForVisit}</p>
                          {appt.notes && <p className="italic text-slate-400">"{appt.notes}"</p>}
                        </div>
                      </div>

                      {/* Dynamic Action Panel */}
                      <div className="pt-3 border-t border-slate-100 flex gap-2">
                        {appt.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(appt._id)}
                              className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setRejectingAppt(appt)}
                              className="flex-1 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-lg transition-colors cursor-pointer border border-rose-200"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {appt.status === 'approved' && (
                          <div className="flex flex-col gap-2 w-full">
                            {appt.appointmentType === 'Online Video Consult' && (
                              <button
                                onClick={() => navigate(`/video-call/${appt._id}`)}
                                className="w-full py-2 bg-linear-to-r from-teal-500 to-indigo-600 hover:from-teal-600 hover:to-indigo-700 text-white font-extrabold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 transition-all cursor-pointer"
                              >
                                <Video className="w-3.5 h-3.5" />
                                Join Video Consultation
                              </button>
                            )}
                            <button
                              onClick={() => handleComplete(appt)}
                              className="w-full py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-800 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                            >
                              Mark Completed & Consult
                            </button>
                          </div>
                        )}
                        {appt.status === 'completed' && (
                          <button
                            onClick={() => {
                              const patId = typeof appt.patientId === 'object' ? appt.patientId._id : appt.patientId;
                              const patProfile = patients.find(p => p._id === patId || p.user?.id === patId || (p.user as any)?._id === patId);
                              if (patProfile) {
                                handleSelectPatient(patProfile);
                                setActiveApptId(appt._id);
                              }
                            }}
                            className="w-full py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-650 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                          >
                            Open EHR File & Write SOAP Note
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PATIENTS DIRECTORY */}
          {activeTab === 'patients' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Panel: Search & Directory list */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col h-[65vh]">
                  <h2 className="text-base font-bold text-slate-800 mb-3">Patient Directory</h2>
                  
                  <div className="relative mb-3">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search patient record..."
                      value={patientSearchQuery}
                      onChange={(e) => setPatientSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:outline-none text-slate-800 text-xs rounded-xl"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                    {filteredPatients.length === 0 ? (
                      <p className="text-slate-400 text-xs text-center py-6">No patient files found.</p>
                    ) : (
                      filteredPatients.map((pat) => (
                        <div
                          key={pat._id}
                          onClick={() => handleSelectPatient(pat)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                            activePatient?._id === pat._id
                              ? 'bg-teal-50 border-teal-300 text-teal-650'
                              : 'bg-slate-50/50 border-slate-150 text-slate-650 hover:border-slate-300'
                          }`}
                        >
                          <p className="text-xs font-bold">{pat.user?.name}</p>
                          <p className="text-[10px] text-slate-450 truncate">{pat.user?.email}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right Panel: Patient EHR File & SOAP Notes Editor */}
                <div className="lg:col-span-2 space-y-5">
                  {activePatient ? (
                    loadingPatientData ? (
                      <div className="bg-white border border-slate-200 rounded-3xl p-12 flex flex-col items-center justify-center">
                        <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mb-2" />
                        <p className="text-slate-450 text-xs">Decrypting EHR cryptfiles...</p>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {/* Profile Header card */}
                        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                            <div>
                              <span className="text-[9px] text-teal-500 uppercase font-black block">Selected Patient File</span>
                              <h2 className="text-xl font-black text-slate-800 mt-1">{activePatient.user?.name}</h2>
                              <p className="text-xs text-slate-500 mt-0.5">Email: {activePatient.user?.email} • DOB: {activePatient.dateOfBirth || 'Not Configured'}</p>
                            </div>
                            
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setEditingNote(null);
                                  resetNote();
                                  setIsNoteModalOpen(true);
                                }}
                                className="px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" /> SOAP Note
                              </button>
                              <button
                                onClick={() => {
                                  resetRecord();
                                  setIsRecordModalOpen(true);
                                }}
                                className="px-3 py-2 bg-indigo-650 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:opacity-95 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" /> EHR File
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 text-xs">
                            <div>
                              <span className="text-slate-400 block">Gender</span>
                              <span className="text-slate-700 font-semibold">{activePatient.gender || 'Not specified'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Blood Group</span>
                              <span className="text-indigo-600 font-bold">{activePatient.bloodGroup || 'O+'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Contact Phone</span>
                              <span className="text-slate-700">{activePatient.phone || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">Emergency Contact</span>
                              <span className="text-slate-700">{activePatient.emergencyContact || 'N/A'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Medical Records Table */}
                        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                          <h3 className="text-base font-bold flex items-center gap-2 mb-3 text-slate-800">
                            <Clipboard className="w-4.5 h-4.5 text-indigo-500" />
                            <span>Diagnosis History & EHR</span>
                          </h3>

                          {activePatientHistory.length === 0 ? (
                            <p className="text-slate-400 text-xs py-3 text-center">No record logs listed in history.</p>
                          ) : (
                            <div className="space-y-3">
                              {activePatientHistory.map((rec) => (
                                <div key={rec._id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-2 text-xs">
                                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                                    <div>
                                      <h4 className="font-bold text-slate-800 text-xs">{rec.diagnosis}</h4>
                                      <span className="text-[9px] text-slate-400">{formatDate(rec.visitDate)}</span>
                                    </div>
                                    <span className="text-[10px] text-teal-650 font-bold">Diag: {getDoctorName(rec.doctorId)}</span>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                                    <p><strong>Symptoms:</strong> {rec.symptoms}</p>
                                    <p><strong>Treatment:</strong> {rec.treatmentPlan}</p>
                                  </div>

                                  {rec.prescription && rec.prescription.medicines && rec.prescription.medicines.length > 0 && (
                                    <div className="p-2.5 bg-teal-55/60 border border-teal-100 rounded-lg text-[11px] mt-1 text-slate-650">
                                      <div className="flex justify-between items-center mb-1.5">
                                        <strong className="text-teal-650">Prescribed Rx:</strong>
                                        <button
                                          onClick={() => rec.prescription?._id && handleDownloadPrescription(rec.prescription._id)}
                                          disabled={downloadingPdfId === rec.prescription?._id}
                                          className="flex items-center gap-1 text-[9px] font-bold text-teal-700 hover:text-teal-900 bg-teal-100 hover:bg-teal-200 px-2 py-0.5 rounded-lg transition border border-teal-300/40 disabled:opacity-50"
                                        >
                                          <Download className="w-2.5 h-2.5" />
                                          {downloadingPdfId === rec.prescription?._id ? 'Downloading...' : 'Download PDF'}
                                        </button>
                                      </div>
                                      <ul className="list-disc pl-4 space-y-0.5">
                                        {rec.prescription.medicines.map((med: any, idx: number) => (
                                          <li key={idx}>
                                            {med.name} - {med.dosage} ({med.frequency} for {med.duration})
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* SOAP Consult Notes */}
                        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                          <h3 className="text-base font-bold flex items-center gap-2 mb-3 text-slate-800">
                            <FileText className="w-4.5 h-4.5 text-teal-500" />
                            <span>Clinical SOAP Consultation Notes</span>
                          </h3>

                          {activePatientNotes.length === 0 ? (
                            <p className="text-slate-400 text-xs py-3 text-center">No clinical notes recorded for patient.</p>
                          ) : (
                            <div className="space-y-3">
                              {activePatientNotes.map((note) => (
                                <div key={note._id} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl space-y-2 text-xs">
                                  <div className="flex justify-between items-center pb-1.5 border-b border-slate-200">
                                    <span className="text-[10px] text-teal-650 font-bold">Consult Date: {new Date(note.consultationDate).toLocaleDateString()}</span>
                                    <div className="flex gap-2">
                                      <button onClick={() => handleEditNote(note)} className="p-1 hover:bg-slate-200 text-slate-400 hover:text-teal-500 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                                      <button onClick={() => handleDeleteNote(note._id)} className="p-1 hover:bg-slate-200 text-slate-400 hover:text-rose-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-650">
                                    <div>
                                      <strong className="text-slate-400 uppercase block tracking-wider mb-0.5">[S] Subjective</strong>
                                      <p className="italic">"{note.subjectiveFindings}"</p>
                                    </div>
                                    <div>
                                      <strong className="text-slate-400 uppercase block tracking-wider mb-0.5">[O] Objective</strong>
                                      <p className="italic">"{note.objectiveFindings}"</p>
                                    </div>
                                    <div>
                                      <strong className="text-slate-400 uppercase block tracking-wider mb-0.5">[A] Assessment</strong>
                                      <p className="font-semibold">{note.assessment}</p>
                                    </div>
                                    <div>
                                      <strong className="text-slate-400 uppercase block tracking-wider mb-0.5">[P] Plan</strong>
                                      <p>{note.plan}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center text-slate-400">
                      <Stethoscope className="w-10 h-10 text-slate-300 mx-auto mb-3 stroke-1" />
                      <h3 className="font-bold text-slate-800 text-base">No Patient File Open</h3>
                      <p className="text-slate-500 text-xs mt-1">Select a patient from the list on the left to inspect logs, view medical records, and write SOAP reports.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: WRITE SOAP CLINICAL NOTE */}
      {isNoteModalOpen && activePatient && (
        <div className="fixed inset-0 z-55 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-zoomIn relative text-slate-800">
            <button 
              onClick={() => {
                setIsNoteModalOpen(false);
                setEditingNote(null);
                resetNote();
              }}
              className="absolute top-4 right-4 p-1 hover:bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h2 className="text-lg font-bold text-slate-800">{editingNote ? 'Edit SOAP Clinical Note' : 'Create SOAP Clinical Note'}</h2>
              <p className="text-slate-555 text-xs mt-0.5">Patient: {activePatient.user?.name}. SOAP details are encrypted in the database.</p>
            </div>

            <form onSubmit={handleSubmitNote(onNoteSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1">Consultation Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:outline-none text-slate-800 text-xs rounded-xl"
                  {...registerNote('consultationDate')}
                />
                {errorsNote.consultationDate && <p className="text-xs text-rose-500 mt-1">{errorsNote.consultationDate.message as string}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1">[S] Subjective Findings</label>
                <textarea
                  rows={2}
                  placeholder="Describe patient's chief complaints and symptoms..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:outline-none text-slate-800 text-xs rounded-xl resize-none"
                  {...registerNote('subjectiveFindings')}
                />
                {errorsNote.subjectiveFindings && <p className="text-xs text-rose-500 mt-1">{errorsNote.subjectiveFindings.message as string}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1">[O] Objective Findings</label>
                <textarea
                  rows={2}
                  placeholder="BP, HR, temperature, physical exam results..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:outline-none text-slate-800 text-xs rounded-xl resize-none"
                  {...registerNote('objectiveFindings')}
                />
                {errorsNote.objectiveFindings && <p className="text-xs text-rose-500 mt-1">{errorsNote.objectiveFindings.message as string}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1">[A] Assessment</label>
                <textarea
                  rows={2}
                  placeholder="Primary clinical impression or diagnostics assessment..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:outline-none text-slate-800 text-xs rounded-xl resize-none"
                  {...registerNote('assessment')}
                />
                {errorsNote.assessment && <p className="text-xs text-rose-500 mt-1">{errorsNote.assessment.message as string}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-550 uppercase tracking-wider mb-1">[P] Plan</label>
                <textarea
                  rows={2}
                  placeholder="Lab tests ordered, medications prescribed, follow-up..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:outline-none text-slate-800 text-xs rounded-xl resize-none"
                  {...registerNote('plan')}
                />
                {errorsNote.plan && <p className="text-xs text-rose-500 mt-1">{errorsNote.plan.message as string}</p>}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-teal-650 bg-gradient-to-r from-teal-500 to-teal-600 hover:opacity-95 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Save Clinical SOAP Log
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE EHR MEDICAL RECORD & PRESCRIPTION */}
      {isRecordModalOpen && activePatient && (
        <div className="fixed inset-0 z-55 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-zoomIn relative text-slate-800">
            <button 
              onClick={() => {
                setIsRecordModalOpen(false);
                resetRecord();
              }}
              className="absolute top-4 right-4 p-1 hover:bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h2 className="text-lg font-bold text-slate-800">Create EHR File & Prescription</h2>
              <p className="text-slate-500 text-xs mt-0.5">Add diagnoses, symptoms, and optional prescription list for {activePatient.user?.name}.</p>
            </div>

            <form onSubmit={handleSubmitRecord(onRecordSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Diagnosis</label>
                  <input
                    type="text"
                    placeholder="e.g. Acute Pharyngitis"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:outline-none text-slate-850 text-xs rounded-xl"
                    {...registerRecord('diagnosis')}
                  />
                  {errorsRecord.diagnosis && <p className="text-xs text-rose-500 mt-1">{errorsRecord.diagnosis.message as string}</p>}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Visit Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:outline-none text-slate-850 text-xs rounded-xl"
                    {...registerRecord('visitDate')}
                  />
                  {errorsRecord.visitDate && <p className="text-xs text-rose-500 mt-1">{errorsRecord.visitDate.message as string}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Symptoms Description</label>
                <textarea
                  rows={2}
                  placeholder="Sore throat, fever (101F), difficulty swallowing..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:outline-none text-slate-800 text-xs rounded-xl resize-none"
                  {...registerRecord('symptoms')}
                />
                {errorsRecord.symptoms && <p className="text-xs text-rose-500 mt-1">{errorsRecord.symptoms.message as string}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Treatment Plan</label>
                <textarea
                  rows={2}
                  placeholder="Rest, hydration, take prescribed antibiotics..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:outline-none text-slate-800 text-xs rounded-xl resize-none"
                  {...registerRecord('treatmentPlan')}
                />
                {errorsRecord.treatmentPlan && <p className="text-xs text-rose-500 mt-1">{errorsRecord.treatmentPlan.message as string}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Allergies Highlighted</label>
                  <input
                    type="text"
                    placeholder="e.g. Penicillin, Pollen"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:outline-none text-slate-800 text-xs rounded-xl"
                    {...registerRecord('allergies')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Generic Medications</label>
                  <input
                    type="text"
                    placeholder="e.g. Amoxicillin 500mg"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:outline-none text-slate-800 text-xs rounded-xl"
                    {...registerRecord('medications')}
                  />
                </div>
              </div>

              {/* Prescription Field array */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-xs font-bold text-indigo-650 uppercase tracking-wider">Official Rx Prescription List</h4>
                  <button
                    type="button"
                    onClick={() => appendMedicine({ name: '', dosage: '', frequency: '', duration: '' })}
                    className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-505 text-white font-bold text-[9px] rounded flex items-center gap-0.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Drug
                  </button>
                </div>

                {medicineFields.map((field, idx) => (
                  <div key={field.id} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center mb-2 pb-2 border-b border-slate-200/40">
                    <input
                      type="text"
                      placeholder="Drug Name"
                      className="col-span-2 px-2 py-1.5 bg-white border border-slate-200 text-xs rounded-lg text-slate-850"
                      {...registerRecord(`medicines.${idx}.name` as any)}
                    />
                    <input
                      type="text"
                      placeholder="Dosage"
                      className="px-2 py-1.5 bg-white border border-slate-200 text-xs rounded-lg text-slate-850"
                      {...registerRecord(`medicines.${idx}.dosage` as any)}
                    />
                    <input
                      type="text"
                      placeholder="Frequency"
                      className="px-2 py-1.5 bg-white border border-slate-200 text-xs rounded-lg text-slate-850"
                      {...registerRecord(`medicines.${idx}.frequency` as any)}
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Duration"
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 text-xs rounded-lg text-slate-850"
                        {...registerRecord(`medicines.${idx}.duration` as any)}
                      />
                      <button
                        type="button"
                        onClick={() => removeMedicine(idx)}
                        className="p-1.5 bg-rose-50 text-rose-500 border border-rose-200 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {medicineFields.length > 0 && (
                  <div className="mt-2.5">
                    <label className="block text-[9px] font-bold text-slate-450 uppercase mb-0.5">Instructions</label>
                    <input
                      type="text"
                      placeholder="e.g. Take medicines after meals."
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 text-xs rounded-lg text-slate-850"
                      {...registerRecord('instructions')}
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-650 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                Compile and Save EHR File
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REJECT APPOINTMENT */}
      {rejectingAppt && (
        <div className="fixed inset-0 z-55 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-zoomIn relative text-slate-800">
            <button 
              onClick={() => {
                setRejectingAppt(null);
                setRejectionReason('');
              }}
              className="absolute top-4 right-4 p-1 hover:bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div>
              <h2 className="text-lg font-bold text-rose-600">Reject Booking Request</h2>
              <p className="text-slate-500 text-xs mt-1">Please enter a reason for rejecting the consultation booking request from {getPatientName(rejectingAppt)}.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-550 uppercase mb-1.5">Rejection Reason</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Doctor unavailable due to surgery schedule clash."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:outline-none text-slate-800 text-xs rounded-xl resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setRejectingAppt(null);
                    setRejectionReason('');
                  }}
                  className="flex-1 py-2 bg-slate-50 hover:bg-slate-105 border border-slate-200 text-xs font-bold rounded-xl text-slate-500 cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectionReason.trim()}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-505 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer transition-colors"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
export default DoctorDashboard;
