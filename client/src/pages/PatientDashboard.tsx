import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../store/authStore';
import { appointmentService, Appointment } from '../services/appointmentService';
import { medicalRecordService, MedicalRecord } from '../services/medicalRecordService';
import { clinicalNoteService, ClinicalNote } from '../services/clinicalNoteService';
import { availabilityService } from '../services/availabilityService';
import DashboardLayout from '../layouts/DashboardLayout';
import { appointmentBookingSchema, rescheduleAppointmentSchema } from '../schemas/validationSchemas';
import { 
  Calendar, FileText, PlusCircle, Search, Clock, 
  AlertCircle, CheckCircle2, Stethoscope, Video, 
  Activity, Clipboard, Eye, X, RefreshCw, Download
} from 'lucide-react';

export const PatientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('summary');

  // Page States
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNote[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Success / Info notifications
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Detail Modal states
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [selectedNote, setSelectedNote] = useState<ClinicalNote | null>(null);

  // Appointment Action States
  const [cancellingAppt, setCancellingAppt] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([]);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState('');

  // Booking Form States
  const [bookingDate, setBookingDate] = useState('');
  const [bookingSlots, setBookingSlots] = useState<string[]>([]);
  const [bookingDuration, setBookingDuration] = useState(30);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');

  // Search/Filter states
  const [apptFilter, setApptFilter] = useState<string>('all');
  const [recordSearch, setRecordSearch] = useState('');
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  const sidebarItems = [
    { label: 'Summary', value: 'summary', icon: Activity },
    { label: 'My Appointments', value: 'appointments', icon: Calendar },
    { label: 'Book Appointment', value: 'book', icon: PlusCircle },
    { label: 'Medical History', value: 'records', icon: FileText },
  ];

  // Load patient dashboard data
  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const apptRes = await appointmentService.getByPatient(user.id);
      setAppointments(apptRes.data || []);

      const recordRes = await medicalRecordService.getByPatient(user.id);
      setRecords(recordRes.data?.records || []);

      const noteRes = await clinicalNoteService.getByPatient(user.id);
      setClinicalNotes(noteRes || []);

      const docsRes = await axiosInstanceGetDoctors();
      setDoctors(docsRes.doctors || []);

      setError(null);
    } catch (err: any) {
      console.error('Error fetching patient data:', err);
      setError('Could not fetch medical or scheduling records. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const axiosInstanceGetDoctors = async () => {
    const importAxios = await import('../api/axios');
    const res = await importAxios.default.get('/auth/doctors');
    return res.data;
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

  const addMinutes = (timeStr: string, minutes: number): string => {
    const [h, m] = timeStr.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!selectedDoctorId || !bookingDate) {
      setBookingSlots([]);
      return;
    }
    const fetchSlots = async () => {
      try {
        const slotsRes = await appointmentService.getAvailableSlots(selectedDoctorId, bookingDate);
        setBookingSlots(slotsRes.availableSlots || []);
        
        try {
          const availRes = await availabilityService.getByDoctor(selectedDoctorId);
          setBookingDuration(availRes.data?.slotDuration || 30);
        } catch {
          setBookingDuration(30);
        }
      } catch (err) {
        showToast('Error loading available timeslots', 'error');
      }
    };
    fetchSlots();
  }, [selectedDoctorId, bookingDate]);

  useEffect(() => {
    if (!reschedulingAppt || !rescheduleDate) {
      setRescheduleSlots([]);
      return;
    }
    const fetchRescheduleSlots = async () => {
      const docId = typeof reschedulingAppt.doctorId === 'object' ? reschedulingAppt.doctorId._id : reschedulingAppt.doctorId;
      try {
        const slotsRes = await appointmentService.getAvailableSlots(docId, rescheduleDate);
        setRescheduleSlots(slotsRes.availableSlots || []);
      } catch {
        showToast('Error loading available timeslots', 'error');
      }
    };
    fetchRescheduleSlots();
  }, [reschedulingAppt, rescheduleDate]);

  const {
    register: registerBook,
    handleSubmit: handleSubmitBook,
    watch: watchBook,
    setValue: setValueBook,
    reset: resetBook,
    formState: { errors: errorsBook }
  } = useForm({
    resolver: zodResolver(appointmentBookingSchema),
    defaultValues: {
      appointmentDate: '',
      startTime: '',
      endTime: '',
      appointmentType: 'Online Video Consult',
      reasonForVisit: '',
      notes: '',
    }
  });

  const selectedBookingSlot = watchBook('startTime');

  const onBookSubmit = async (data: any) => {
    if (!user) return;
    if (!selectedDoctorId) {
      showToast('Please select a doctor', 'error');
      return;
    }
    if (!data.startTime) {
      showToast('Please select an available timeslot', 'error');
      return;
    }

    try {
      const payload = {
        patientId: user.id,
        doctorId: selectedDoctorId,
        appointmentDate: data.appointmentDate,
        startTime: data.startTime,
        endTime: data.endTime,
        appointmentType: data.appointmentType,
        reasonForVisit: data.reasonForVisit,
        notes: data.notes,
      };

      await appointmentService.book(payload);
      showToast('Appointment booked successfully!');
      resetBook();
      setSelectedDoctorId('');
      setBookingDate('');
      setBookingSlots([]);
      loadData();
      setActiveTab('appointments');
    } catch (err: any) {
      const errText = err?.response?.data?.error || 'Booking failed. Collision detected or slot unavailable.';
      showToast(errText, 'error');
    }
  };

  const handleCancelAppt = async () => {
    if (!cancellingAppt) return;
    if (!cancelReason.trim()) {
      showToast('Please provide a reason for cancellation', 'error');
      return;
    }
    try {
      await appointmentService.cancel(cancellingAppt._id, cancelReason);
      showToast('Appointment cancelled successfully');
      setCancellingAppt(null);
      setCancelReason('');
      loadData();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Cancellation failed', 'error');
    }
  };

  const handleRescheduleAppt = async () => {
    if (!reschedulingAppt || !rescheduleDate || !selectedRescheduleSlot) {
      showToast('Please pick a date and time slot', 'error');
      return;
    }
    try {
      let docDuration = 30;
      const docId = typeof reschedulingAppt.doctorId === 'object' ? reschedulingAppt.doctorId._id : reschedulingAppt.doctorId;
      try {
        const availRes = await availabilityService.getByDoctor(docId);
        docDuration = availRes.data?.slotDuration || 30;
      } catch {}

      const endTime = addMinutes(selectedRescheduleSlot, docDuration);
      await appointmentService.reschedule(reschedulingAppt._id, {
        newDate: rescheduleDate,
        newStartTime: selectedRescheduleSlot,
        newEndTime: endTime,
      });

      showToast('Appointment rescheduled successfully!');
      setReschedulingAppt(null);
      setRescheduleDate('');
      setSelectedRescheduleSlot('');
      loadData();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Reschedule failed. Collision detected.', 'error');
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  };

  const filteredAppts = appointments.filter((appt) => {
    if (apptFilter === 'all') return true;
    return appt.status.toLowerCase() === apptFilter.toLowerCase();
  });

  const filteredRecords = records.filter((rec) => {
    const term = recordSearch.toLowerCase();
    const docName = rec.doctorId?.user?.name?.toLowerCase() || '';
    const diag = rec.diagnosis?.toLowerCase() || '';
    const sym = rec.symptoms?.toLowerCase() || '';
    return diag.includes(term) || sym.includes(term) || docName.includes(term);
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'completed':
        return 'bg-emerald-55 border-emerald-200 text-emerald-600';
      case 'rejected':
      case 'cancelled':
        return 'bg-red-50 border-red-200 text-red-600';
      default:
        return 'bg-amber-50 border-amber-200 text-amber-600';
    }
  };

  const getDoctorName = (doc: any) => {
    if (!doc) return 'Medical Officer';
    if (typeof doc === 'object') {
      return doc.user?.name ? `Dr. ${doc.user.name}` : 'Doctor Profile';
    }
    const match = doctors.find((d) => d._id === doc || d.user?._id === doc);
    return match?.user?.name ? `Dr. ${match.user.name}` : 'Dr. Practitioner';
  };

  return (
    <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab} sidebarItems={sidebarItems}>
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-5 right-5 z-55 p-4 border rounded-2xl flex items-center gap-3 backdrop-blur-md shadow-2xl animate-slideIn ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-red-50 border-red-500 text-red-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[350px]">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-500 text-xs">Loading your personal portal details...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-4 max-w-2xl mx-auto my-6 text-red-800">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-base text-slate-800">Database Sync Issue</h3>
            <p className="text-xs mt-1 text-slate-600">{error}</p>
            <button onClick={loadData} className="mt-4 px-4 py-2 bg-white border border-slate-300 text-xs rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50">
              <RefreshCw className="w-3.5 h-3.5" /> Retry Connection
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* TAB 1: SUMMARY */}
          {activeTab === 'summary' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                <h1 className="text-2xl font-black text-slate-800">Hello, {user?.name}!</h1>
                <p className="text-slate-500 text-xs mt-1">Welcome to your secure patient console. Book consultations, view medical records, or review doctors.</p>
                
                {/* Stats Blocks */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                  <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-2xl">
                    <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider block">Upcoming Appointments</span>
                    <span className="text-2xl font-black text-slate-800 mt-0.5 block">
                      {appointments.filter(a => a.status === 'approved' || a.status === 'pending').length}
                    </span>
                  </div>
                  <div className="p-4 bg-teal-50/40 border border-teal-100 rounded-2xl">
                    <span className="text-[10px] text-teal-500 font-bold uppercase tracking-wider block">Total Diagnoses</span>
                    <span className="text-2xl font-black text-slate-800 mt-0.5 block">{records.length}</span>
                  </div>
                  <div className="p-4 bg-sky-50/40 border border-sky-100 rounded-2xl">
                    <span className="text-[10px] text-sky-500 font-bold uppercase tracking-wider block">Clinical SOAP Notes</span>
                    <span className="text-2xl font-black text-slate-800 mt-0.5 block">{clinicalNotes.length}</span>
                  </div>
                </div>
              </div>

              {/* Two Column Panels */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Upcoming Consultations */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col min-h-[220px]">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <Calendar className="w-4.5 h-4.5 text-indigo-500" />
                      <span>Upcoming Consultations</span>
                    </h2>
                    <button onClick={() => setActiveTab('appointments')} className="text-xs font-bold text-indigo-600 hover:underline">View All</button>
                  </div>
                  
                  <div className="flex-1 space-y-3">
                    {appointments.filter(a => a.status === 'approved' || a.status === 'pending').slice(0, 3).length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center p-4 text-center text-slate-400">
                        <Clock className="w-8 h-8 mb-2 stroke-1 text-slate-300" />
                        <p className="text-xs">No upcoming appointments scheduled.</p>
                      </div>
                    ) : (
                      appointments
                        .filter(a => a.status === 'approved' || a.status === 'pending')
                        .slice(0, 3)
                        .map((appt) => (
                          <div key={appt._id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold text-slate-800">{getDoctorName(appt.doctorId)}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                                <Calendar className="w-3 h-3 text-indigo-400" />
                                {formatDate(appt.appointmentDate)} @ {appt.startTime}
                              </p>
                            </div>
                            <span className={`px-2 py-0.5 text-[9px] uppercase font-bold border rounded-full ${getStatusBadgeClass(appt.status)}`}>
                              {appt.status}
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Right: Recent EHR Records */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col min-h-[220px]">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <FileText className="w-4.5 h-4.5 text-teal-500" />
                      <span>Recent Medical Records</span>
                    </h2>
                    <button onClick={() => setActiveTab('records')} className="text-xs font-bold text-teal-600 hover:underline">View All</button>
                  </div>

                  <div className="flex-1 space-y-3">
                    {records.slice(0, 3).length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center p-4 text-center text-slate-400">
                        <Clipboard className="w-8 h-8 mb-2 stroke-1 text-slate-300" />
                        <p className="text-xs">No electronic health records found.</p>
                      </div>
                    ) : (
                      records.slice(0, 3).map((rec) => (
                        <div key={rec._id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-800 truncate max-w-[180px]">{rec.diagnosis}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{getDoctorName(rec.doctorId)} • {formatDate(rec.visitDate)}</p>
                          </div>
                          <button 
                            onClick={() => setSelectedRecord(rec)}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition-colors border border-slate-200"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MY APPOINTMENTS */}
          {activeTab === 'appointments' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-xl font-black text-slate-800">My Consultations</h1>
                  <p className="text-slate-500 text-xs mt-0.5">Filter, cancel, or reschedule bookings with practitioners.</p>
                </div>
                
                {/* Status filter tabs */}
                <div className="flex flex-wrap gap-2">
                  {['All', 'Pending', 'Approved', 'Cancelled', 'Completed'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setApptFilter(tab.toLowerCase())}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                        apptFilter === tab.toLowerCase()
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                          : 'bg-white border-slate-200 hover:border-slate-350 text-slate-505'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Appointments list */}
              {filteredAppts.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 max-w-xl mx-auto">
                  <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3 stroke-1" />
                  <h3 className="font-bold text-slate-800 text-base">No appointments found</h3>
                  <p className="text-slate-500 text-xs mt-1">There are no consultations matching your filter criteria.</p>
                  <button onClick={() => setActiveTab('book')} className="mt-4 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold rounded-xl text-white">
                    Book Appointment Now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredAppts.map((appt) => (
                    <div key={appt._id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">{appt.appointmentType}</span>
                            <h3 className="text-base font-black text-slate-800 mt-0.5">{getDoctorName(appt.doctorId)}</h3>
                          </div>
                          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase border rounded-full ${getStatusBadgeClass(appt.status)}`}>
                            {appt.status}
                          </span>
                        </div>
                        
                        <div className="space-y-2 text-xs text-slate-500 mb-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                            <span>{formatDate(appt.appointmentDate)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
                            <span>{appt.startTime} - {appt.endTime}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <Clipboard className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">Reason: {appt.reasonForVisit}</span>
                          </div>
                          {appt.rejectionReason && (
                            <div className="p-2 bg-red-50 border border-red-100 rounded-lg text-[11px] text-red-700">
                              <strong>Rejection:</strong> {appt.rejectionReason}
                            </div>
                          )}
                          {appt.cancellationReason && (
                            <div className="p-2 bg-slate-50 border border-slate-150 rounded-lg text-[11px] text-slate-500">
                              <strong>Cancellation:</strong> {appt.cancellationReason}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Active actions */}
                      {(appt.status === 'pending' || appt.status === 'approved') && (
                        <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
                          {appt.status === 'approved' && appt.appointmentType === 'Online Video Consult' && (
                            <button
                              onClick={() => navigate(`/video-call/${appt._id}`)}
                              className="w-full py-2.5 bg-linear-to-r from-teal-500 to-indigo-600 hover:from-teal-600 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 transition-all cursor-pointer"
                            >
                              <Video className="w-3.5 h-3.5" />
                              Join Video Consultation
                            </button>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => {
                                setReschedulingAppt(appt);
                                setRescheduleDate('');
                                setRescheduleSlots([]);
                                setSelectedRescheduleSlot('');
                              }}
                              className="py-2 text-center bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold rounded-xl text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
                            >
                              Reschedule
                            </button>
                            <button
                              onClick={() => {
                                setCancellingAppt(appt);
                                setCancelReason('');
                              }}
                              className="py-2 text-center bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-bold rounded-xl text-red-600 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: BOOK APPOINTMENT */}
          {activeTab === 'book' && (
            <div className="max-w-xl mx-auto animate-fadeIn bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <div>
                <h1 className="text-xl font-black text-slate-800">Request a Consultation</h1>
                <p className="text-slate-500 text-xs mt-1">Select an active doctor, input your medical purpose, and select an available slot.</p>
              </div>

              <form onSubmit={handleSubmitBook(onBookSubmit)} className="space-y-5 mt-6">
                {/* Doctor Selection */}
                <div>
                  <label htmlFor="docSelect" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Select Practitioner
                  </label>
                  <select
                    id="docSelect"
                    value={selectedDoctorId}
                    onChange={(e) => {
                      setSelectedDoctorId(e.target.value);
                      setValueBook('startTime', '');
                    }}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:outline-none text-slate-800 text-xs rounded-xl"
                  >
                    <option value="">-- Choose a Doctor --</option>
                    {doctors.map((doc) => (
                      <option key={doc._id || doc.user?._id} value={doc.user?._id}>
                        Dr. {doc.user?.name} ({doc.specialization}) - Fee: ${doc.consultationFee || 50}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Grid for Date picker and consultation type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="bookingDate" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      Consultation Date
                    </label>
                    <input
                      id="bookingDate"
                      type="date"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:outline-none text-slate-850 text-xs rounded-xl"
                      {...registerBook('appointmentDate')}
                      onChange={(e) => {
                        registerBook('appointmentDate').onChange(e);
                        setBookingDate(e.target.value);
                        setValueBook('startTime', '');
                      }}
                    />
                    {errorsBook.appointmentDate && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errorsBook.appointmentDate.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="consultType" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      Consultation Channel
                    </label>
                    <select
                      id="consultType"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:outline-none text-slate-800 text-xs rounded-xl"
                      {...registerBook('appointmentType')}
                    >
                      <option value="Online Video Consult">Online Video Consult</option>
                      <option value="In-Person Clinic Visit">In-Person Clinic Visit</option>
                      <option value="Telephone Consultation">Telephone Consultation</option>
                    </select>
                  </div>
                </div>

                {/* Available Slots Grid */}
                {selectedDoctorId && bookingDate && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                      Select Available Slot ({bookingDuration} mins)
                    </label>
                    
                    {bookingSlots.length === 0 ? (
                      <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl text-center text-slate-400 text-xs">
                        No availability slots on this day. Please try another date or check schedule.
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto p-1">
                        {bookingSlots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => {
                              setValueBook('startTime', slot);
                              setValueBook('endTime', addMinutes(slot, bookingDuration));
                            }}
                            className={`py-1.5 text-center text-xs font-bold border rounded-lg transition-colors cursor-pointer ${
                              selectedBookingSlot === slot
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-800'
                            }`}
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    )}
                    {errorsBook.startTime && (
                      <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {errorsBook.startTime.message}
                      </p>
                    )}
                  </div>
                )}

                {/* Reason for Visit */}
                <div>
                  <label htmlFor="reason" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Reason for Consult
                  </label>
                  <input
                    id="reason"
                    type="text"
                    placeholder="Regular cardiological review, persistent cough"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:outline-none text-slate-800 text-xs rounded-xl"
                    {...registerBook('reasonForVisit')}
                  />
                  {errorsBook.reasonForVisit && (
                    <p className="mt-1 text-xs text-red-500 flex items-center gap-1 font-semibold">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errorsBook.reasonForVisit.message}
                    </p>
                  )}
                </div>

                {/* Medical Notes */}
                <div>
                  <label htmlFor="notes" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                    Additional Patient Notes (Optional)
                  </label>
                  <textarea
                    id="notes"
                    rows={2}
                    placeholder="List symptoms, current drugs, or questions."
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:outline-none text-slate-800 text-xs rounded-xl resize-none"
                    {...registerBook('notes')}
                  />
                </div>

                {/* Action Buttons */}
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-indigo-650 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  Request Consultation Appointment
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: MEDICAL RECORDS */}
          {activeTab === 'records' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Header and Search */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-xl font-black text-slate-800">Electronic Health Records (EHR)</h1>
                  <p className="text-slate-500 text-xs mt-0.5">Secure, cryptographically decrypted medical record files.</p>
                </div>
                <div className="relative w-full md:w-72">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by diagnosis..."
                    value={recordSearch}
                    onChange={(e) => setRecordSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:outline-none text-slate-800 text-xs rounded-xl"
                  />
                </div>
              </div>

              {/* Records and Clinical Notes Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left (2 Cols): Medical Record History */}
                <div className="lg:col-span-2 space-y-4">
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Clipboard className="w-4.5 h-4.5 text-indigo-500" />
                    <span>Diagnoses & Treatment Plans</span>
                  </h2>

                  {filteredRecords.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-400">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs">No medical records found matching search terms.</p>
                    </div>
                  ) : (
                    filteredRecords.map((rec) => (
                      <div key={rec._id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                        <div className="flex justify-between items-start pb-2 border-b border-slate-100">
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold block uppercase">{formatDate(rec.visitDate)}</span>
                            <h3 className="text-base font-black text-slate-800 mt-0.5">{rec.diagnosis}</h3>
                            <span className="text-xs text-slate-500">{getDoctorName(rec.doctorId)}</span>
                          </div>
                          <button
                            onClick={() => setSelectedRecord(rec)}
                            className="px-3 py-1.5 text-[11px] font-bold bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-800 transition-colors"
                          >
                            Details
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Symptoms</span>
                            <span className="text-slate-600 line-clamp-2 mt-0.5">{rec.symptoms}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block uppercase">Treatment Plan</span>
                            <span className="text-slate-600 line-clamp-2 mt-0.5">{rec.treatmentPlan}</span>
                          </div>
                        </div>

                        {rec.prescription && rec.prescription.medicines && rec.prescription.medicines.length > 0 && (
                          <div className="p-3 bg-indigo-50 border border-indigo-100 text-slate-700 rounded-xl mt-1 text-xs">
                            <span className="font-bold text-indigo-700 block mb-1">Prescription Included:</span>
                            <ul className="list-disc pl-4 space-y-1 text-slate-600">
                              {rec.prescription.medicines.map((med, idx) => (
                                <li key={idx}>
                                  <strong>{med.name}</strong> - {med.dosage} ({med.frequency} for {med.duration})
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Right (1 Col): Clinical Notes Overview */}
                <div className="space-y-4">
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-4.5 h-4.5 text-teal-500" />
                    <span>SOAP Consultation Notes</span>
                  </h2>

                  {clinicalNotes.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-400">
                      <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs">No SOAP consultation notes available.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {clinicalNotes.map((note) => (
                        <div 
                          key={note._id} 
                          onClick={() => setSelectedNote(note)}
                          className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-teal-500/50 shadow-sm cursor-pointer transition-all hover:scale-[1.01]"
                        >
                          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                            <span className="text-xs text-teal-600 font-bold">{getDoctorName(note.doctorId)}</span>
                            <span className="text-[9px] text-slate-400">{new Date(note.consultationDate).toLocaleDateString()}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-2 font-semibold uppercase tracking-wider">Assessment summary</p>
                          <p className="text-xs font-bold text-slate-700 truncate mt-0.5">{note.assessment}</p>
                          <span className="text-[9px] font-bold text-teal-600 hover:text-teal-700 mt-2 block">Click to view SOAP fields</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: MEDICAL RECORD DETAIL */}
      {selectedRecord && (
        <div className="fixed inset-0 z-55 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto animate-zoomIn relative text-slate-800">
            <button 
              onClick={() => setSelectedRecord(null)}
              className="absolute top-4 right-4 p-1 hover:bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block tracking-wider">Medical File Detail</span>
              <h2 className="text-xl font-black text-slate-800 mt-0.5">{selectedRecord.diagnosis}</h2>
              <p className="text-xs text-slate-500 mt-1">{getDoctorName(selectedRecord.doctorId)} • {formatDate(selectedRecord.visitDate)}</p>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Symptoms</span>
                <p className="text-slate-700 mt-1 text-xs bg-slate-50 border border-slate-100 p-3 rounded-xl">{selectedRecord.symptoms}</p>
              </div>

              <div>
                <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Treatment Plan & Medication Schedule</span>
                <p className="text-slate-700 mt-1 text-xs bg-slate-50 border border-slate-100 p-3 rounded-xl whitespace-pre-wrap">{selectedRecord.treatmentPlan}</p>
              </div>

              {selectedRecord.medications && (
                <div>
                  <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Medications</span>
                  <p className="text-slate-700 mt-1 text-xs bg-slate-50 border border-slate-100 p-3 rounded-xl">{selectedRecord.medications}</p>
                </div>
              )}

              {selectedRecord.allergies && selectedRecord.allergies.length > 0 && (
                <div>
                  <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Allergies Highlighted</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedRecord.allergies.map((alg, index) => (
                      <span key={index} className="px-2 py-0.5 bg-red-50 border border-red-100 text-red-650 text-xs rounded-lg font-semibold">
                        {alg}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedRecord.notes && (
                <div>
                  <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Clinical Notes</span>
                  <p className="text-slate-500 mt-1 text-xs italic whitespace-pre-wrap">{selectedRecord.notes}</p>
                </div>
              )}

              {selectedRecord.prescription && selectedRecord.prescription.medicines && selectedRecord.prescription.medicines.length > 0 && (
                <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-indigo-650 text-xs uppercase tracking-wider">Official Rx Prescription</h4>
                    <button
                      onClick={() => selectedRecord.prescription?._id && handleDownloadPrescription(selectedRecord.prescription._id)}
                      disabled={downloadingPdfId === selectedRecord.prescription?._id}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-650 hover:text-indigo-800 bg-indigo-100/50 hover:bg-indigo-100 px-2.5 py-1 rounded-xl transition border border-indigo-200/50 disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {downloadingPdfId === selectedRecord.prescription?._id ? 'Downloading...' : 'Download PDF'}
                    </button>
                  </div>
                  <table className="w-full text-[11px] text-left text-slate-600">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-widest text-[9px]">
                        <th className="py-1.5">Medicine Name</th>
                        <th className="py-1.5">Dosage</th>
                        <th className="py-1.5">Frequency</th>
                        <th className="py-1.5">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRecord.prescription.medicines.map((med, idx) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="py-1.5 font-bold text-slate-800">{med.name}</td>
                          <td className="py-1.5">{med.dosage}</td>
                          <td className="py-1.5">{med.frequency}</td>
                          <td className="py-1.5">{med.duration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {selectedRecord.prescription.instructions && (
                    <div className="mt-2.5 text-[11px] border-t border-slate-200 pt-2 text-slate-500">
                      <strong>Instructions:</strong> {selectedRecord.prescription.instructions}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SOAP NOTE DETAIL */}
      {selectedNote && (
        <div className="fixed inset-0 z-55 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto animate-zoomIn relative text-slate-800">
            <button 
              onClick={() => setSelectedNote(null)}
              className="absolute top-4 right-4 p-1 hover:bg-slate-50 border border-slate-200 text-slate-400 hover:text-white rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div>
              <span className="text-[9px] text-teal-650 font-bold uppercase block tracking-wider">Clinical SOAP Consult Record</span>
              <h2 className="text-lg font-black text-slate-800 mt-0.5">{getDoctorName(selectedNote.doctorId)}</h2>
              <p className="text-xs text-slate-500 mt-1">Consultation Date: {new Date(selectedNote.consultationDate).toLocaleString()}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                <span className="text-[10px] font-bold text-indigo-650 uppercase tracking-widest block mb-1">[S] Subjective Findings</span>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedNote.subjectiveFindings}</p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                <span className="text-[10px] font-bold text-indigo-650 uppercase tracking-widest block mb-1">[O] Objective Findings</span>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedNote.objectiveFindings}</p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                <span className="text-[10px] font-bold text-teal-650 uppercase tracking-widest block mb-1">[A] Assessment</span>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedNote.assessment}</p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                <span className="text-[10px] font-bold text-teal-650 uppercase tracking-widest block mb-1">[P] Plan</span>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedNote.plan}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESCHEDULE APPOINTMENT */}
      {reschedulingAppt && (
        <div className="fixed inset-0 z-55 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-5 animate-zoomIn relative text-slate-800">
            <button 
              onClick={() => {
                setReschedulingAppt(null);
                setRescheduleDate('');
                setRescheduleSlots([]);
                setSelectedRescheduleSlot('');
              }}
              className="absolute top-4 right-4 p-1 hover:bg-slate-50 border border-slate-200 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div>
              <h2 className="text-lg font-bold text-slate-800">Reschedule Consultation</h2>
              <p className="text-slate-500 text-xs mt-1">Select a new date and start time slot for your appointment with {getDoctorName(reschedulingAppt.doctorId)}.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Pick New Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    setRescheduleDate(e.target.value);
                    setSelectedRescheduleSlot('');
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:outline-none text-slate-800 text-xs rounded-xl"
                />
              </div>

              {rescheduleDate && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Available Slots</label>
                  {rescheduleSlots.length === 0 ? (
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center text-slate-400 text-xs">
                      No availability on this date.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto p-1">
                      {rescheduleSlots.map((slot) => (
                        <button
                          key={slot}
                          onClick={() => setSelectedRescheduleSlot(slot)}
                          className={`py-1.5 px-1 text-center text-xs font-bold border rounded-lg ${
                            selectedRescheduleSlot === slot
                              ? 'bg-indigo-650 text-white'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-350'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                disabled={!rescheduleDate || !selectedRescheduleSlot}
                onClick={handleRescheduleAppt}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-sm transition-colors"
              >
                Confirm Rescheduling
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CANCEL APPOINTMENT */}
      {cancellingAppt && (
        <div className="fixed inset-0 z-55 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-5 animate-zoomIn relative text-slate-800">
            <button 
              onClick={() => {
                setCancellingAppt(null);
                setCancelReason('');
              }}
              className="absolute top-4 right-4 p-1 hover:bg-slate-50 border border-slate-200 text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div>
              <h2 className="text-lg font-bold text-red-600">Cancel Appointment</h2>
              <p className="text-slate-500 text-xs mt-1">Are you sure you want to cancel your consultation with {getDoctorName(cancellingAppt.doctorId)}?</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Reason for Cancellation</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Schedule conflicts, resolved medical concern."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:outline-none text-slate-800 text-xs rounded-xl resize-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setCancellingAppt(null);
                    setCancelReason('');
                  }}
                  className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold rounded-xl text-slate-500 cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handleCancelAppt}
                  disabled={!cancelReason.trim()}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer transition-colors"
                >
                  Yes, Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
export default PatientDashboard;
