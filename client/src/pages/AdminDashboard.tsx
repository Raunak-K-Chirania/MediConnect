import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../store/authStore';
import { 
  adminService, 
  PlatformStatistics, 
  AuditLog, 
  AdminUser, 
  AdminAppointment, 
  AdminPrescription, 
  SystemSettings 
} from '../services/adminService';
import { availabilityService, DoctorAvailability } from '../services/availabilityService';
import DashboardLayout from '../layouts/DashboardLayout';
import { availabilityConfigSchema } from '../schemas/validationSchemas';
import { 
  Shield, Users, Calendar, Activity, Database, Clock, 
  AlertCircle, CheckCircle2, Search, X, Plus, Trash2, RefreshCw,
  Settings, FileText, Download, UserCheck, ToggleLeft, ToggleRight,
  Eye, Lock, Filter, SlidersHorizontal, AlertTriangle, Check, ArrowRight, ExternalLink
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('summary');

  // Core Data States
  const [stats, setStats] = useState<PlatformStatistics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User Management State
  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'Patient' | 'Doctor' | 'Admin'>('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [reviewCertUser, setReviewCertUser] = useState<AdminUser | null>(null);
  const [certNotes, setCertNotes] = useState('');
  const [verifyingCert, setVerifyingCert] = useState(false);

  // Appointments Management State
  const [appointmentsList, setAppointmentsList] = useState<AdminAppointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [apptSearchQuery, setApptSearchQuery] = useState('');
  const [apptStatusFilter, setApptStatusFilter] = useState<string>('all');
  const [updatingApptId, setUpdatingApptId] = useState<string | null>(null);

  // Prescriptions Oversight State
  const [prescriptionsList, setPrescriptionsList] = useState<AdminPrescription[]>([]);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);
  const [rxSearchQuery, setRxSearchQuery] = useState('');
  const [viewRxModal, setViewRxModal] = useState<AdminPrescription | null>(null);

  // System Settings State
  const [settings, setSettings] = useState<SystemSettings>({
    maintenanceMode: false,
    announcementText: '',
    announcementActive: false,
    requireDoctorVerification: false,
    maxBookingDaysInAdvance: 30,
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Availability Management States
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [docAvailability, setDocAvailability] = useState<DoctorAvailability | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Notification Toast State
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Audit Filtering States
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditFilterStatus, setAuditFilterStatus] = useState<'all' | 'success' | 'error'>('all');

  const sidebarItems = [
    { label: 'Overview', value: 'summary', icon: Activity },
    { label: 'Users Management', value: 'users', icon: Users },
    { label: 'Appointments Control', value: 'appointments', icon: Calendar },
    { label: 'Prescriptions Oversight', value: 'prescriptions', icon: FileText },
    { label: 'Doctor Availability', value: 'availability', icon: Clock },
    { label: 'Audit Logs', value: 'audits', icon: Database },
    { label: 'System Settings', value: 'settings', icon: Settings },
  ];

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch statistics
      const statsRes = await adminService.getStatistics();
      setStats(statsRes);

      // 2. Fetch audit logs
      const logsRes = await adminService.getAuditLogs();
      setAuditLogs(logsRes.logs || []);

      // 3. Fetch doctors list for availability select
      const docsRes = await axiosInstanceGetDoctors();
      setDoctors(docsRes.doctors || []);

      setError(null);
    } catch (err: any) {
      console.error('Error fetching admin data:', err);
      setError('Could not load administrative details. Ensure you are authorized and backend is active.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await adminService.getUsers();
      setUsersList(res.users || []);
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to fetch users list', 'error');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchAppointments = async () => {
    setLoadingAppointments(true);
    try {
      const res = await adminService.getAppointments();
      setAppointmentsList(res.appointments || []);
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to fetch platform appointments', 'error');
    } finally {
      setLoadingAppointments(false);
    }
  };

  const fetchPrescriptions = async () => {
    setLoadingPrescriptions(true);
    try {
      const res = await adminService.getPrescriptions();
      setPrescriptionsList(res.prescriptions || []);
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to fetch platform prescriptions', 'error');
    } finally {
      setLoadingPrescriptions(false);
    }
  };

  const fetchSettings = async () => {
    setLoadingSettings(true);
    try {
      const res = await adminService.getSettings();
      if (res.settings) setSettings(res.settings);
    } catch (err: any) {
      showToast('Failed to load system settings', 'error');
    } finally {
      setLoadingSettings(false);
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

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'appointments') fetchAppointments();
    if (activeTab === 'prescriptions') fetchPrescriptions();
    if (activeTab === 'settings') fetchSettings();
  }, [activeTab]);

  // Actions for User Management
  const handleRoleChange = async (userId: string, newRole: 'Patient' | 'Doctor' | 'Admin') => {
    setUpdatingUserId(userId);
    try {
      const res = await adminService.updateUserRole(userId, newRole);
      showToast(res.message || `Role updated to ${newRole}`);
      fetchUsers();
      loadData();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to update user role', 'error');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${userName}"?`)) return;
    setUpdatingUserId(userId);
    try {
      const res = await adminService.deleteUser(userId);
      showToast(res.message || 'User deleted successfully');
      fetchUsers();
      loadData();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to delete user', 'error');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleToggleDoctorAvailability = async (doctorId: string) => {
    try {
      const res = await adminService.toggleDoctorAvailability(doctorId);
      showToast(`Doctor availability set to ${res.available ? 'Available' : 'Unavailable'}`);
      fetchUsers();
    } catch (err: any) {
      showToast('Failed to toggle doctor availability', 'error');
    }
  };

  const handleVerifyCert = async (doctorId: string, status: 'Approved' | 'Rejected' | 'Pending') => {
    setVerifyingCert(true);
    try {
      const res = await adminService.verifyDoctorCertificate(doctorId, status, certNotes);
      showToast(res.message || `Doctor certificate marked as ${status}`);
      setReviewCertUser(null);
      setCertNotes('');
      fetchUsers();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to verify doctor certificate', 'error');
    } finally {
      setVerifyingCert(false);
    }
  };

  // Actions for Appointments Management
  const handleUpdateApptStatus = async (apptId: string, newStatus: string) => {
    setUpdatingApptId(apptId);
    try {
      const res = await adminService.updateAppointmentStatus(apptId, newStatus);
      showToast(res.message || `Appointment status changed to ${newStatus}`);
      fetchAppointments();
      loadData();
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to update status', 'error');
    } finally {
      setUpdatingApptId(null);
    }
  };

  // Action for System Settings Save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await adminService.updateSettings(settings);
      if (res.settings) setSettings(res.settings);
      showToast('System settings updated successfully!');
    } catch (err: any) {
      showToast('Failed to update system settings', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  // CSV Export for Audit Logs
  const exportAuditLogsToCSV = () => {
    if (filteredAuditLogs.length === 0) {
      showToast('No logs available to export', 'error');
      return;
    }
    const headers = ['Timestamp', 'User Name', 'User Email', 'Method', 'Endpoint', 'Action', 'Status', 'IP Address'];
    const rows = filteredAuditLogs.map(log => [
      new Date(log.timestamp).toISOString(),
      log.userId?.name || 'Anonymous',
      log.userId?.email || 'N/A',
      log.method,
      log.apiEndpoint,
      log.performedAction || log.action || 'SYSTEM',
      log.statusCode,
      log.ipAddress
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.map(cell => `"${cell}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `mediconnect_audit_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Audit logs exported successfully');
  };

  // Form for Doctor Availability Configuration
  const {
    register: registerAvail,
    handleSubmit: handleSubmitAvail,
    control: controlAvail,
    watch: watchAvail,
    reset: resetAvail,
    formState: { errors: errorsAvail }
  } = useForm<any>({
    resolver: zodResolver(availabilityConfigSchema),
    defaultValues: {
      workingDays: [],
      startHour: '09:00',
      endHour: '17:00',
      slotDuration: 30,
      breakSlots: [],
    }
  });

  const { fields: breakFields, append: appendBreak, remove: removeBreak } = useFieldArray({
    control: controlAvail,
    name: 'breakSlots' as any
  });

  // Load doctor availability when selected in dropdown
  useEffect(() => {
    if (!selectedDoctorId) {
      setDocAvailability(null);
      resetAvail({
        workingDays: [],
        startHour: '09:00',
        endHour: '17:00',
        slotDuration: 30,
        breakSlots: [],
      });
      return;
    }

    const fetchAvailability = async () => {
      setLoadingAvailability(true);
      try {
        const res = await availabilityService.getByDoctor(selectedDoctorId);
        if (res.data) {
          setDocAvailability(res.data);
          resetAvail({
            workingDays: res.data.workingDays,
            startHour: res.data.startHour,
            endHour: res.data.endHour,
            slotDuration: res.data.slotDuration,
            breakSlots: res.data.breakSlots || [],
          });
        }
      } catch (err: any) {
        setDocAvailability(null);
        resetAvail({
          workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          startHour: '09:00',
          endHour: '17:00',
          slotDuration: 30,
          breakSlots: [],
        });
        showToast('No availability found. You can configure a new schedule.', 'error');
      } finally {
        setLoadingAvailability(false);
      }
    };
    fetchAvailability();
  }, [selectedDoctorId]);

  const onAvailabilitySubmit = async (data: any) => {
    if (!selectedDoctorId) return;
    try {
      if (docAvailability) {
        await availabilityService.update(docAvailability._id, data);
        showToast('Doctor availability updated successfully!');
      } else {
        await availabilityService.create({
          doctorId: selectedDoctorId,
          ...data,
        });
        showToast('Doctor availability created successfully!');
      }
      const res = await availabilityService.getByDoctor(selectedDoctorId);
      setDocAvailability(res.data);
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to save availability schedule.', 'error');
    }
  };

  // Filter audit logs
  const filteredAuditLogs = auditLogs.filter((log) => {
    const query = auditSearchQuery.toLowerCase();
    const action = log.performedAction?.toLowerCase() || '';
    const userMail = log.userId?.email?.toLowerCase() || '';
    const userName = log.userId?.name?.toLowerCase() || '';
    const endpoint = log.apiEndpoint?.toLowerCase() || '';
    
    const matchesSearch = action.includes(query) || userMail.includes(query) || userName.includes(query) || endpoint.includes(query);
    
    if (auditFilterStatus === 'all') return matchesSearch;
    if (auditFilterStatus === 'success') return matchesSearch && log.statusCode < 400;
    return matchesSearch && log.statusCode >= 400;
  });

  // Filter Users
  const filteredUsers = usersList.filter((u) => {
    const q = userSearchQuery.toLowerCase();
    const matchesQ = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.doctorProfile?.specialization || '').toLowerCase().includes(q);
    if (userRoleFilter === 'all') return matchesQ;
    return matchesQ && u.role === userRoleFilter;
  });

  // Filter Appointments
  const filteredAppointments = appointmentsList.filter((a) => {
    const q = apptSearchQuery.toLowerCase();
    const patientName = a.patientId?.name || '';
    const doctorName = a.doctorId?.name || '';
    const reason = a.reasonForVisit || a.reason || '';
    const matchesQ = patientName.toLowerCase().includes(q) || doctorName.toLowerCase().includes(q) || reason.toLowerCase().includes(q);
    if (apptStatusFilter === 'all') return matchesQ;
    return matchesQ && a.status === apptStatusFilter;
  });

  // Filter Prescriptions
  const filteredPrescriptions = prescriptionsList.filter((rx) => {
    const q = rxSearchQuery.toLowerCase();
    const patientName = rx.patientId?.user?.name || '';
    const doctorName = rx.doctorId?.user?.name || '';
    const meds = rx.medicines.map(m => m.name).join(' ').toLowerCase();
    return patientName.toLowerCase().includes(q) || doctorName.toLowerCase().includes(q) || meds.includes(q);
  });

  return (
    <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab} sidebarItems={sidebarItems}>
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 p-3.5 border rounded-2xl flex items-center gap-3 backdrop-blur-md shadow-xl transition-all animate-bounce ${
          toast.type === 'success' ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900' : 'bg-red-50/90 border-red-300 text-red-900'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[350px]">
          <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-slate-500 text-xs font-medium">Connecting to MediConnect System Control...</p>
        </div>
      ) : error ? (
        <div className="p-5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3.5 max-w-2xl mx-auto my-6 text-red-800 animate-fadeIn">
          <AlertCircle className="w-5.5 h-5.5 text-red-550 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-sm text-slate-800">Database Connection Issue</h3>
            <p className="text-xs mt-1 text-slate-600">{error}</p>
            <button onClick={loadData} className="mt-3.5 px-3.5 py-1.5 bg-white border border-slate-300 text-xs rounded-xl font-bold flex items-center gap-1.5 hover:bg-slate-50 text-slate-700 shadow-sm">
              <RefreshCw className="w-3.5 h-3.5" /> Retry Connection
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* TAB 1: SUMMARY STATS & OVERVIEW */}
          {activeTab === 'summary' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <Shield className="w-6 h-6 text-rose-600" />
                      Platform Administrative Console
                    </h1>
                    <p className="text-slate-500 text-xs mt-1">Full governance system for users, clinical schedules, appointments, prescriptions, and system traces.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setActiveTab('users')} className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 flex items-center gap-1.5 transition-colors">
                      <Users className="w-4 h-4" /> Manage Users
                    </button>
                    <button onClick={() => setActiveTab('settings')} className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-colors">
                      <Settings className="w-4 h-4" /> System Settings
                    </button>
                  </div>
                </div>

                {/* Statistics Panel */}
                {stats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                    <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center justify-between shadow-sm">
                      <div>
                        <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider block">Total Patients</span>
                        <span className="text-2xl font-black text-indigo-950 mt-1 block">{stats.totalPatients}</span>
                      </div>
                      <Users className="w-7 h-7 text-indigo-500 shrink-0" />
                    </div>

                    <div className="p-4 bg-teal-50/50 border border-teal-100 rounded-2xl flex items-center justify-between shadow-sm">
                      <div>
                        <span className="text-[10px] text-teal-600 font-bold uppercase tracking-wider block">Total Doctors</span>
                        <span className="text-2xl font-black text-teal-950 mt-1 block">{stats.totalDoctors}</span>
                      </div>
                      <Shield className="w-7 h-7 text-teal-500 shrink-0" />
                    </div>

                    <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl flex items-center justify-between shadow-sm">
                      <div>
                        <span className="text-[10px] text-rose-600 font-bold uppercase tracking-wider block">Appointments</span>
                        <span className="text-2xl font-black text-rose-950 mt-1 block">{stats.totalAppointments}</span>
                      </div>
                      <Calendar className="w-7 h-7 text-rose-500 shrink-0" />
                    </div>

                    <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-center justify-between shadow-sm">
                      <div>
                        <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">Active Users</span>
                        <span className="text-2xl font-black text-emerald-950 mt-1 block">{stats.activeUsers}</span>
                      </div>
                      <Activity className="w-7 h-7 text-emerald-500 shrink-0" />
                    </div>
                  </div>
                )}
              </div>

              {/* Quick View of Recent Audits */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-bold flex items-center gap-2 text-slate-800">
                    <Database className="w-4.5 h-4.5 text-rose-500" />
                    <span>Real-time Audit Trace Stream</span>
                  </h2>
                  <button onClick={() => setActiveTab('audits')} className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline">View Full Logs &rarr;</button>
                </div>

                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {auditLogs.slice(0, 6).length === 0 ? (
                    <p className="text-slate-400 text-center py-6 text-xs font-semibold">No recent activities logged.</p>
                  ) : (
                    auditLogs.slice(0, 6).map((log) => (
                      <div key={log._id} className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between text-xs transition-colors hover:bg-slate-100/60">
                        <div className="space-y-0.5 min-w-0 flex-1 mr-3">
                          <p className="font-bold text-slate-800 uppercase tracking-wider text-[11px] truncate">{log.performedAction || log.action || 'API ACCESS'}</p>
                          <p className="text-slate-500 text-[10px] truncate">{log.userId?.name || 'Anonymous'} ({log.userId?.email || 'N/A'}) &bull; {log.apiEndpoint} &bull; IP: {log.ipAddress}</p>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end">
                          <span className={`px-2 py-0.5 font-bold rounded-lg text-[10px] ${log.statusCode < 400 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                            {log.statusCode}
                          </span>
                          <span className="text-[9px] text-slate-400 block mt-1">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <h1 className="text-lg font-black text-slate-900">User Account Control</h1>
                  <p className="text-slate-500 text-xs mt-0.5">Manage user profiles, promote/demote accounts, toggle doctor availability, and revoke access.</p>
                </div>

                <div className="flex gap-2 w-full md:w-auto shrink-0">
                  <div className="relative flex-1 md:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search users or email..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none text-slate-800 text-xs rounded-xl"
                    />
                  </div>

                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value as any)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl focus:border-rose-500 focus:outline-none font-medium"
                  >
                    <option value="all">All Roles</option>
                    <option value="Patient">Patients</option>
                    <option value="Doctor">Doctors</option>
                    <option value="Admin">Admins</option>
                  </select>
                </div>
              </div>

              {/* Users Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {loadingUsers ? (
                  <div className="p-8 text-center">
                    <div className="w-6 h-6 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-slate-500 text-xs">Loading user registry...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-slate-700">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                        <tr>
                          <th className="px-4 py-3">User</th>
                          <th className="px-4 py-3">Current Role</th>
                          <th className="px-4 py-3">Doctor Availability</th>
                          <th className="px-4 py-3">Practitioner Cert</th>
                          <th className="px-4 py-3">Joined Date</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-xs font-semibold">
                              No matching users found in registry.
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((u) => (
                            <tr key={u._id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-3">
                                <p className="font-bold text-slate-900 leading-tight">{u.name}</p>
                                <p className="text-[10px] text-slate-500">{u.email}</p>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                  u.role === 'Admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                  u.role === 'Doctor' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                                }`}>
                                  {u.role}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {u.doctorProfile ? (
                                  <button
                                    onClick={() => handleToggleDoctorAvailability(u.doctorProfile!._id)}
                                    className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border flex items-center gap-1 transition-colors ${
                                      u.doctorProfile.available 
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                                        : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                    }`}
                                  >
                                    {u.doctorProfile.available ? <UserCheck className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                    {u.doctorProfile.available ? 'Available' : 'Unavailable'}
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-medium">N/A</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {u.doctorProfile ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                      u.doctorProfile.verificationStatus === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                      u.doctorProfile.verificationStatus === 'Rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}>
                                      {u.doctorProfile.verificationStatus || 'Pending'}
                                    </span>
                                    <button
                                      onClick={() => {
                                        setReviewCertUser(u);
                                        setCertNotes(u.doctorProfile?.verificationNotes || '');
                                      }}
                                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded border border-slate-250 flex items-center gap-1"
                                      title="Review Practitioner Certificate"
                                    >
                                      <Eye className="w-3 h-3" /> Review
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-medium">N/A</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-[11px] text-slate-500 font-medium">
                                {new Date(u.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {/* Role Selector */}
                                  <select
                                    value={u.role}
                                    disabled={updatingUserId === u._id || u._id === user?.id}
                                    onChange={(e) => handleRoleChange(u._id, e.target.value as any)}
                                    className="px-2 py-1 bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-lg focus:outline-none focus:border-rose-500 disabled:opacity-50"
                                  >
                                    <option value="Patient">Patient</option>
                                    <option value="Doctor">Doctor</option>
                                    <option value="Admin">Admin</option>
                                  </select>

                                  <button
                                    disabled={updatingUserId === u._id || u._id === user?.id}
                                    onClick={() => handleDeleteUser(u._id, u.name)}
                                    className="p-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-40"
                                    title="Delete User Account"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: APPOINTMENTS CONTROL */}
          {activeTab === 'appointments' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <h1 className="text-lg font-black text-slate-900">Appointments Control Center</h1>
                  <p className="text-slate-500 text-xs mt-0.5">Override status, confirm, or cancel consultations across the entire health system.</p>
                </div>

                <div className="flex gap-2 w-full md:w-auto shrink-0">
                  <div className="relative flex-1 md:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search patient or doctor..."
                      value={apptSearchQuery}
                      onChange={(e) => setApptSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none text-slate-800 text-xs rounded-xl"
                    />
                  </div>

                  <select
                    value={apptStatusFilter}
                    onChange={(e) => setApptStatusFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl focus:border-rose-500 focus:outline-none font-medium"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {/* Appointments Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {loadingAppointments ? (
                  <div className="p-8 text-center">
                    <div className="w-6 h-6 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-slate-500 text-xs">Fetching appointment records...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-slate-700">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Date & Time</th>
                          <th className="px-4 py-3">Patient</th>
                          <th className="px-4 py-3">Doctor</th>
                          <th className="px-4 py-3">Type & Reason</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Admin Override</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredAppointments.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-xs font-semibold">
                              No appointments matching criteria.
                            </td>
                          </tr>
                        ) : (
                          filteredAppointments.map((appt) => (
                            <tr key={appt._id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <p className="font-bold text-slate-900 leading-tight">
                                  {new Date(appt.appointmentDate).toLocaleDateString()}
                                </p>
                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  {appt.startTime} - {appt.endTime}
                                </p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-bold text-slate-850">{appt.patientId?.name || 'Unknown Patient'}</p>
                                <p className="text-[10px] text-slate-450">{appt.patientId?.email || ''}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-bold text-teal-800">Dr. {appt.doctorId?.name || 'Unassigned'}</p>
                                <p className="text-[10px] text-slate-450">{appt.doctorId?.email || ''}</p>
                              </td>
                              <td className="px-4 py-3 max-w-xs">
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-bold uppercase tracking-wider block w-max mb-1">
                                  {appt.appointmentType || 'General'}
                                </span>
                                <p className="text-slate-600 text-[11px] truncate">{appt.reasonForVisit || appt.reason || 'Routine'}</p>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${
                                  appt.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  appt.status === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                  appt.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}>
                                  {appt.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <select
                                  value={appt.status}
                                  disabled={updatingApptId === appt._id}
                                  onChange={(e) => handleUpdateApptStatus(appt._id, e.target.value)}
                                  className="px-2 py-1 bg-white border border-slate-250 text-slate-800 text-[10px] font-bold rounded-lg focus:outline-none focus:border-rose-500"
                                >
                                  <option value="pending">Set Pending</option>
                                  <option value="approved">Approve</option>
                                  <option value="completed">Complete</option>
                                  <option value="cancelled">Cancel</option>
                                  <option value="rejected">Reject</option>
                                </select>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: PRESCRIPTIONS OVERSIGHT */}
          {activeTab === 'prescriptions' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <h1 className="text-lg font-black text-slate-900">Prescriptions & Medical Oversight</h1>
                  <p className="text-slate-500 text-xs mt-0.5">Audit cryptographically signed digital prescriptions issued across the system.</p>
                </div>

                <div className="relative w-full md:w-72 shrink-0">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by medicine, patient or doctor..."
                    value={rxSearchQuery}
                    onChange={(e) => setRxSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none text-slate-800 text-xs rounded-xl"
                  />
                </div>
              </div>

              {/* Prescriptions Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {loadingPrescriptions ? (
                  <div className="p-8 text-center">
                    <div className="w-6 h-6 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-slate-500 text-xs">Loading prescription records...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left text-slate-700">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Prescription ID / Date</th>
                          <th className="px-4 py-3">Patient</th>
                          <th className="px-4 py-3">Prescribing Doctor</th>
                          <th className="px-4 py-3">Medicines Prescribed</th>
                          <th className="px-4 py-3">HMAC Hash</th>
                          <th className="px-4 py-3 text-right">Inspect</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPrescriptions.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-xs font-semibold">
                              No prescription records found.
                            </td>
                          </tr>
                        ) : (
                          filteredPrescriptions.map((rx) => (
                            <tr key={rx._id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-3 font-mono">
                                <p className="font-bold text-slate-900 text-[11px]">#{rx._id.slice(-8).toUpperCase()}</p>
                                <p className="text-[10px] text-slate-400">{new Date(rx.createdAt).toLocaleDateString()}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-bold text-slate-850">{rx.patientId?.user?.name || 'Patient'}</p>
                                <p className="text-[10px] text-slate-450">{rx.patientId?.user?.email || ''}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-bold text-teal-800">Dr. {rx.doctorId?.user?.name || 'Doctor'}</p>
                                <p className="text-[10px] text-slate-450">{rx.doctorId?.user?.email || ''}</p>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {rx.medicines.map((m, idx) => (
                                    <span key={idx} className="px-2 py-0.5 bg-teal-50 border border-teal-150 text-teal-800 text-[10px] font-semibold rounded-md">
                                      {m.name} ({m.dosage})
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-mono text-[10px] text-slate-400 max-w-xs truncate">
                                {rx.hash ? `${rx.hash.slice(0, 16)}...` : 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => setViewRxModal(rx)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg border border-slate-250 flex items-center gap-1 ml-auto"
                                >
                                  <Eye className="w-3 h-3" /> View Detail
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Prescription Detail Modal */}
              {viewRxModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-fadeIn">
                    <div className="flex justify-between items-center border-b pb-3">
                      <div>
                        <h3 className="font-black text-slate-900 text-base">Prescription Details</h3>
                        <p className="text-slate-400 text-xs font-mono">ID: #{viewRxModal._id}</p>
                      </div>
                      <button onClick={() => setViewRxModal(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Patient</span>
                        <span className="font-bold text-slate-800">{viewRxModal.patientId?.user?.name}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Doctor</span>
                        <span className="font-bold text-teal-800">Dr. {viewRxModal.doctorId?.user?.name}</span>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-700 mb-2">Prescribed Medicines</h4>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {viewRxModal.medicines.map((m, idx) => (
                          <div key={idx} className="p-2.5 bg-teal-50/40 border border-teal-100 rounded-xl flex justify-between items-center text-xs">
                            <div>
                              <p className="font-bold text-teal-900">{m.name}</p>
                              <p className="text-[10px] text-slate-500">Frequency: {m.frequency || 'N/A'} &bull; Duration: {m.duration || 'N/A'}</p>
                            </div>
                            <span className="px-2 py-0.5 bg-teal-100 text-teal-800 font-mono text-[10px] font-bold rounded">
                              {m.dosage}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {viewRxModal.instructions && (
                      <div className="text-xs">
                        <span className="font-bold text-slate-700 block mb-1">Clinical Instructions</span>
                        <p className="p-2.5 bg-slate-50 border rounded-xl text-slate-600 italic">{viewRxModal.instructions}</p>
                      </div>
                    )}

                    <div className="pt-2 border-t flex justify-end">
                      <button onClick={() => setViewRxModal(null)} className="px-4 py-1.5 bg-slate-900 text-white font-bold text-xs rounded-xl">
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: DOCTOR AVAILABILITY CONFIGURATION */}
          {activeTab === 'availability' && (
            <div className="max-w-xl mx-auto animate-fadeIn bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div>
                <h1 className="text-lg font-black text-slate-900">Doctor Availability Scheduler</h1>
                <p className="text-slate-500 text-xs mt-0.5">Select a doctor profile to inspect or adjust availability working hours and break slots.</p>
              </div>

              <div className="mt-5 space-y-4">
                {/* Doctor Picker */}
                <div>
                  <label htmlFor="adminDocPick" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Select Doctor Profile</label>
                  <select
                    id="adminDocPick"
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none text-slate-800 text-xs rounded-xl font-medium"
                  >
                    <option value="">-- Choose Doctor to Manage Availability --</option>
                    {doctors.map((doc) => (
                      <option key={doc._id} value={doc.user?._id}>
                        Dr. {doc.user?.name} ({doc.specialization})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedDoctorId && (
                  loadingAvailability ? (
                    <div className="flex flex-col items-center justify-center p-8">
                      <div className="w-6 h-6 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mb-2" />
                      <p className="text-slate-500 text-[10px]">Loading availability config...</p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitAvail(onAvailabilitySubmit)} className="space-y-4 pt-3 border-t border-slate-100 animate-fadeIn">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Working Days</label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                            <label
                              key={day}
                              className={`flex items-center justify-center p-1.5 border rounded-lg text-[10px] font-semibold cursor-pointer transition-colors ${
                                watchAvail('workingDays')?.includes(day)
                                  ? 'bg-rose-50 border-rose-300 text-rose-700 font-bold'
                                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                value={day}
                                className="hidden"
                                {...registerAvail('workingDays')}
                              />
                              <span>{day}</span>
                            </label>
                          ))}
                        </div>
                        {errorsAvail.workingDays && (
                          <p className="mt-1 text-[10px] text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {errorsAvail.workingDays.message as string}
                          </p>
                        )}
                      </div>

                      {/* Working Hours Grid */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Start (HH:MM)</label>
                          <input
                            type="text"
                            placeholder="09:00"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:outline-none text-slate-800 text-xs rounded-lg font-mono"
                            {...registerAvail('startHour')}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">End (HH:MM)</label>
                          <input
                            type="text"
                            placeholder="17:00"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:outline-none text-slate-800 text-xs rounded-lg font-mono"
                            {...registerAvail('endHour')}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Slot (mins)</label>
                          <input
                            type="number"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:outline-none text-slate-800 text-xs rounded-lg font-mono"
                            {...registerAvail('slotDuration', { valueAsNumber: true })}
                          />
                        </div>
                      </div>

                      {/* Break Slots */}
                      <div className="p-3.5 bg-rose-50/30 border border-rose-100 rounded-xl">
                        <div className="flex justify-between items-center mb-2.5">
                          <h4 className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Break Slots Config</h4>
                          <button
                            type="button"
                            onClick={() => appendBreak({ start: '13:00', end: '14:00' })}
                            className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[9px] rounded flex items-center gap-0.5 transition-colors"
                          >
                            <Plus className="w-3 h-3" /> Add Break
                          </button>
                        </div>

                        {breakFields.map((field, idx) => (
                          <div key={field.id} className="flex gap-2 items-center mb-1.5 animate-fadeIn">
                            <div className="flex-1 flex gap-2">
                              <input
                                type="text"
                                placeholder="Start e.g. 13:00"
                                className="w-full px-2.5 py-1 bg-white border border-slate-200 text-xs rounded-lg font-mono text-slate-800 focus:border-rose-500 focus:outline-none"
                                {...registerAvail(`breakSlots.${idx}.start` as any)}
                              />
                              <input
                                type="text"
                                placeholder="End e.g. 14:00"
                                className="w-full px-2.5 py-1 bg-white border border-slate-200 text-xs rounded-lg font-mono text-slate-800 focus:border-rose-500 focus:outline-none"
                                {...registerAvail(`breakSlots.${idx}.end` as any)}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeBreak(idx)}
                              className="p-1 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-[0.99] cursor-pointer"
                      >
                        {docAvailability ? 'Update Availability Schedule' : 'Create Availability Schedule'}
                      </button>
                    </form>
                  )
                )}
              </div>
            </div>
          )}

          {/* TAB 6: AUDIT LOGS DISPLAY */}
          {activeTab === 'audits' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <h1 className="text-lg font-black text-slate-900">System Audit Records</h1>
                  <p className="text-slate-500 text-xs mt-0.5">Cryptographically logged system interaction trails for compliance and security audit.</p>
                </div>

                <div className="flex gap-2 w-full md:w-auto shrink-0">
                  <button
                    onClick={exportAuditLogsToCSV}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </button>

                  <div className="relative flex-1 md:w-60">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search logs or email..."
                      value={auditSearchQuery}
                      onChange={(e) => setAuditSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none text-slate-800 text-xs rounded-xl"
                    />
                  </div>

                  <select
                    value={auditFilterStatus}
                    onChange={(e) => setAuditFilterStatus(e.target.value as any)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded-xl focus:border-rose-500 focus:outline-none"
                  >
                    <option value="all">All HTTP</option>
                    <option value="success">Success (2xx)</option>
                    <option value="error">Errors (&ge;400)</option>
                  </select>
                </div>
              </div>

              {/* Audit Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-slate-700">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[9px] text-slate-500 uppercase font-bold tracking-widest">
                      <tr>
                        <th className="px-4 py-2.5">Timestamp</th>
                        <th className="px-4 py-2.5">User Name / Email</th>
                        <th className="px-4 py-2.5">API Endpoint / Method</th>
                        <th className="px-4 py-2.5">Performed Action</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5">IP Address</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAuditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-xs font-semibold">
                            No matching system activity trace files found.
                          </td>
                        </tr>
                      ) : (
                        filteredAuditLogs.map((log) => (
                          <tr key={log._id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap text-slate-500">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5">
                              <p className="font-bold text-slate-900 leading-tight">{log.userId?.name || 'Anonymous'}</p>
                              <span className="text-[9px] text-slate-450">{log.userId?.email || 'API client'}</span>
                            </td>
                            <td className="px-4 py-2.5 text-xs font-mono text-slate-600">
                              <span className={`px-1.5 py-0.5 rounded font-bold mr-2 text-[8px] ${
                                log.method === 'GET' ? 'bg-blue-50 text-blue-650 border border-blue-150' :
                                log.method === 'POST' ? 'bg-emerald-50 border border-emerald-150 text-emerald-700' :
                                log.method === 'PUT' ? 'bg-amber-50 border border-amber-150 text-amber-700' : 'bg-rose-50 border border-rose-150 text-rose-700'
                              }`}>
                                {log.method}
                              </span>
                              {log.apiEndpoint}
                            </td>
                            <td className="px-4 py-2.5 text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">
                              {log.performedAction || log.action || 'SYSTEM'}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <span className={`px-2 py-0.5 text-[10px] font-bold border rounded-lg ${
                                log.statusCode < 400 
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                  : 'bg-rose-50 border-rose-200 text-rose-700'
                              }`}>
                                {log.statusCode}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs font-mono text-slate-450">
                              {log.ipAddress}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: SYSTEM SETTINGS */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto animate-fadeIn bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              <div>
                <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-rose-600" /> System Settings & Controls
                </h1>
                <p className="text-slate-500 text-xs mt-0.5">Configure platform announcements, maintenance mode, and operational parameters.</p>
              </div>

              {loadingSettings ? (
                <div className="p-8 text-center">
                  <div className="w-6 h-6 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-slate-500 text-xs">Loading system settings...</p>
                </div>
              ) : (
                <form onSubmit={handleSaveSettings} className="space-y-5">
                  {/* Maintenance Mode Toggle */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">System Maintenance Mode</h4>
                      <p className="text-[11px] text-slate-500">Temporarily restrict non-admin access for scheduled system updates.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettings(s => ({ ...s, maintenanceMode: !s.maintenanceMode }))}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all ${
                        settings.maintenanceMode ? 'bg-amber-600 text-white border-amber-700' : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      {settings.maintenanceMode ? <AlertTriangle className="w-4 h-4" /> : <Check className="w-4 h-4 text-emerald-600" />}
                      {settings.maintenanceMode ? 'Maintenance ON' : 'Normal Operation'}
                    </button>
                  </div>

                  {/* Announcement Banner */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">Global Announcement Bar</h4>
                        <p className="text-[11px] text-slate-500">Display a system banner across patient and doctor dashboards.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSettings(s => ({ ...s, announcementActive: !s.announcementActive }))}
                        className={`px-3 py-1 text-[11px] font-bold rounded-lg border transition-colors ${
                          settings.announcementActive ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-200 text-slate-600 border-slate-300'
                        }`}
                      >
                        {settings.announcementActive ? 'Banner Active' : 'Banner Inactive'}
                      </button>
                    </div>

                    <input
                      type="text"
                      value={settings.announcementText}
                      onChange={(e) => setSettings(s => ({ ...s, announcementText: e.target.value }))}
                      placeholder="Enter announcement text..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 text-xs rounded-xl focus:border-rose-500 focus:outline-none"
                    />
                  </div>

                  {/* Max Booking Days in Advance */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">Maximum Appointment Booking Window</h4>
                      <p className="text-[11px] text-slate-500">Limit how far in advance patients can schedule appointments (days).</p>
                    </div>
                    <input
                      type="number"
                      value={settings.maxBookingDaysInAdvance}
                      onChange={(e) => setSettings(s => ({ ...s, maxBookingDaysInAdvance: Number(e.target.value) }))}
                      className="w-24 px-3 py-1.5 bg-white border border-slate-200 text-xs font-mono font-bold rounded-xl text-center focus:border-rose-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
                  >
                    {savingSettings ? 'Saving Settings...' : 'Save System Configuration'}
                  </button>
                </form>
              )}
            </div>
          )}
        </>
      )}

      {/* MODAL: REVIEW DOCTOR PRACTITIONER CERTIFICATE */}
      {reviewCertUser && reviewCertUser.doctorProfile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-fadeIn relative">
            <button
              onClick={() => {
                setReviewCertUser(null);
                setCertNotes('');
              }}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block">Practitioner Verification</span>
              <h3 className="font-black text-slate-900 text-base">Review Medical Certificate: Dr. {reviewCertUser.name}</h3>
              <p className="text-slate-500 text-xs mt-0.5">{reviewCertUser.email} &bull; {reviewCertUser.doctorProfile.specialization || 'General Practice'}</p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Cert Reg Number</span>
                  <span className="font-mono font-bold text-slate-800">{reviewCertUser.doctorProfile.certificateNumber || 'Not provided'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">License Number</span>
                  <span className="font-mono font-bold text-slate-800">{reviewCertUser.doctorProfile.licenseNumber}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Expiry Date</span>
                  <span className="font-medium text-slate-700">
                    {reviewCertUser.doctorProfile.certificateExpiryDate 
                      ? new Date(reviewCertUser.doctorProfile.certificateExpiryDate).toLocaleDateString() 
                      : 'Not specified'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Current Verification</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    reviewCertUser.doctorProfile.verificationStatus === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                    reviewCertUser.doctorProfile.verificationStatus === 'Rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {reviewCertUser.doctorProfile.verificationStatus || 'Pending'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Practitioner Certificate Link</span>
                {reviewCertUser.doctorProfile.certificateUrl ? (
                  <a
                    href={reviewCertUser.doctorProfile.certificateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-teal-50 border border-teal-200 rounded-lg text-teal-800 font-bold text-xs flex items-center gap-1.5 hover:bg-teal-100 transition-colors w-max"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open Certificate Document Link &rarr;
                  </a>
                ) : (
                  <span className="text-slate-400 italic text-xs">No certificate document link submitted yet.</span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Admin Review Notes / Rejection Reason
              </label>
              <textarea
                rows={2}
                value={certNotes}
                onChange={(e) => setCertNotes(e.target.value)}
                placeholder="Add verification notes or reason for rejection if applicable..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-xs rounded-xl focus:border-rose-500 focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                disabled={verifyingCert}
                onClick={() => handleVerifyCert(reviewCertUser.doctorProfile!._id, 'Approved')}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                Approve Certificate
              </button>
              <button
                disabled={verifyingCert}
                onClick={() => handleVerifyCert(reviewCertUser.doctorProfile!._id, 'Rejected')}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                Reject Certificate
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AdminDashboard;
