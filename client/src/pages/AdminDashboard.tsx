import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../store/authStore';
import { adminService, PlatformStatistics, AuditLog } from '../services/adminService';
import { availabilityService, DoctorAvailability } from '../services/availabilityService';
import DashboardLayout from '../layouts/DashboardLayout';
import { availabilityConfigSchema } from '../schemas/validationSchemas';
import { 
  Shield, Users, Calendar, Activity, Database, Clock, 
  AlertCircle, CheckCircle2, Search, X, Plus, Trash2, RefreshCw, Siren
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

  // Availability Management States
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [docAvailability, setDocAvailability] = useState<DoctorAvailability | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Success / Error notification
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filtering states
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditFilterStatus, setAuditFilterStatus] = useState<'all' | 'success' | 'error'>('all');

  const sidebarItems = [
    { label: 'Overview', value: 'summary', icon: Activity },
    { label: 'Doctor Availability', value: 'availability', icon: Clock },
    { label: 'Audit Logs', value: 'audits', icon: Database },
  ];

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

  // Form for Doctor Availability Configuration
  const {
    register: registerAvail,
    handleSubmit: handleSubmitAvail,
    setValue: setValueAvail,
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
        // If not found (404), allow creation from scratch
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
        // Update existing availability
        await availabilityService.update(docAvailability._id, data);
        showToast('Doctor availability updated successfully!');
      } else {
        // Create new availability
        await availabilityService.create({
          doctorId: selectedDoctorId,
          ...data,
        });
        showToast('Doctor availability created successfully!');
      }
      
      // Reload availability config
      const res = await availabilityService.getByDoctor(selectedDoctorId);
      setDocAvailability(res.data);
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to save availability schedule.', 'error');
    }
  };

  // Filter Audit logs
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

  return (
    <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab} sidebarItems={sidebarItems}>
      {/* Toast alert */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 p-3 border rounded-xl flex items-center gap-2.5 backdrop-blur-md shadow-lg animate-slideIn ${
          toast.type === 'success' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4.5 h-4.5 text-rose-500" /> : <AlertCircle className="w-4.5 h-4.5 text-red-500" />}
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-slate-500 text-xs">Loading System Console database...</p>
        </div>
      ) : error ? (
        <div className="p-5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3.5 max-w-2xl mx-auto my-6 text-red-800 animate-fadeIn">
          <AlertCircle className="w-5.5 h-5.5 text-red-550 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-sm text-slate-800">Database Sync Issue</h3>
            <p className="text-xs mt-1 text-slate-600">{error}</p>
            <button onClick={loadData} className="mt-3.5 px-3 py-1.5 bg-white border border-slate-350 text-xs rounded-xl font-bold flex items-center gap-1.5 hover:bg-slate-50 text-slate-700">
              <RefreshCw className="w-3.5 h-3.5" /> Retry Connection
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* TAB 1: SUMMARY STATS */}
          {activeTab === 'summary' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <h1 className="text-xl font-black text-slate-800 mb-0.5">Administrative Console</h1>
                <p className="text-slate-500 text-xs">Review overall system operation, check doctor schedulers, and monitor audit traces.</p>

                {/* Statistics panel */}
                {stats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
                    <div className="p-4 bg-indigo-50/40 border border-indigo-100/60 rounded-xl flex items-center justify-between shadow-sm">
                      <div>
                        <span className="text-[10px] text-indigo-550 font-bold uppercase tracking-wider block">Total Patients</span>
                        <span className="text-2xl font-black text-indigo-950 mt-0.5 block">{stats.totalPatients}</span>
                      </div>
                      <Users className="w-6.5 h-6.5 text-indigo-500 shrink-0" />
                    </div>

                    <div className="p-4 bg-teal-50/40 border border-teal-100/60 rounded-xl flex items-center justify-between shadow-sm">
                      <div>
                        <span className="text-[10px] text-teal-550 font-bold uppercase tracking-wider block">Total Doctors</span>
                        <span className="text-2xl font-black text-teal-950 mt-0.5 block">{stats.totalDoctors}</span>
                      </div>
                      <Shield className="w-6.5 h-6.5 text-teal-500 shrink-0" />
                    </div>

                    <div className="p-4 bg-rose-50/40 border border-rose-100/60 rounded-xl flex items-center justify-between shadow-sm">
                      <div>
                        <span className="text-[10px] text-rose-550 font-bold uppercase tracking-wider block">Total Appointments</span>
                        <span className="text-2xl font-black text-rose-950 mt-0.5 block">{stats.totalAppointments}</span>
                      </div>
                      <Calendar className="w-6.5 h-6.5 text-rose-500 shrink-0" />
                    </div>

                    <div className="p-4 bg-emerald-50/40 border border-emerald-100/60 rounded-xl flex items-center justify-between shadow-sm">
                      <div>
                        <span className="text-[10px] text-emerald-550 font-bold uppercase tracking-wider block">Active Users</span>
                        <span className="text-2xl font-black text-emerald-950 mt-0.5 block">{stats.activeUsers}</span>
                      </div>
                      <Activity className="w-6.5 h-6.5 text-emerald-500 shrink-0" />
                    </div>
                  </div>
                )}
              </div>

              {/* Quick view of recent audits */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-base font-bold flex items-center gap-2 text-slate-800">
                    <Database className="w-4.5 h-4.5 text-rose-500" />
                    <span>Recent System Activity Traces</span>
                  </h2>
                  <button onClick={() => setActiveTab('audits')} className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline">View Full Logs</button>
                </div>

                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {auditLogs.slice(0, 5).length === 0 ? (
                    <p className="text-slate-400 text-center py-6 text-xs font-semibold">No recent activities logged.</p>
                  ) : (
                    auditLogs.slice(0, 5).map((log) => (
                      <div key={log._id} className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between text-xs transition-colors hover:bg-slate-100/50">
                        <div className="space-y-0.5 min-w-0 flex-1 mr-3">
                          <p className="font-bold text-slate-750 uppercase tracking-wider text-[11px] truncate">{log.performedAction || log.action || 'API ACCESS'}</p>
                          <p className="text-slate-500 text-[10px] truncate">{log.userId?.name || 'Anonymous'} • {log.apiEndpoint} • IP: {log.ipAddress}</p>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end">
                          <span className={`px-2 py-0.5 font-bold rounded-lg text-[10px] ${log.statusCode < 400 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                            {log.statusCode}
                          </span>
                          <span className="text-[9px] text-slate-450 block mt-1">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DOCTOR AVAILABILITY CONFIGURATION */}
          {activeTab === 'availability' && (
            <div className="max-w-xl mx-auto animate-fadeIn bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div>
                <h1 className="text-lg font-black text-slate-850">Doctor Availability Scheduler</h1>
                <p className="text-slate-500 text-[11px] mt-0.5">Select a doctor to inspect, configure, or adjust availability working hours and breaks.</p>
              </div>

              <div className="mt-5 space-y-4">
                {/* Doctor Picker */}
                <div>
                  <label htmlFor="adminDocPick" className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1.5">Select Doctor Profile</label>
                  <select
                    id="adminDocPick"
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none text-slate-800 text-xs rounded-xl"
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
                      {/* Working Days Multiselect */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-555 uppercase tracking-wider mb-2">Working Days</label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                            <label
                              key={day}
                              className={`flex items-center justify-center p-1.5 border rounded-lg text-[10px] font-semibold cursor-pointer transition-colors ${
                                watchAvail('workingDays')?.includes(day)
                                  ? 'bg-rose-50 border-rose-350 text-rose-600 font-bold'
                                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-350'
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
                          <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">Start Hour (HH:MM)</label>
                          <input
                            type="text"
                            placeholder="09:00"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-205 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none text-slate-800 text-xs rounded-lg"
                            {...registerAvail('startHour')}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">End Hour (HH:MM)</label>
                          <input
                            type="text"
                            placeholder="17:00"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-205 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none text-slate-800 text-xs rounded-lg"
                            {...registerAvail('endHour')}
                          />
                          {errorsAvail.endHour && <p className="text-[10px] text-red-500 mt-0.5">{errorsAvail.endHour.message as string}</p>}
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-1">Slot (mins)</label>
                          <input
                            type="number"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-205 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none text-slate-800 text-xs rounded-lg"
                            {...registerAvail('slotDuration', { valueAsNumber: true })}
                          />
                          {errorsAvail.slotDuration && <p className="text-[10px] text-red-500 mt-0.5">{errorsAvail.slotDuration.message as string}</p>}
                        </div>
                      </div>

                      {/* Break slots configuration */}
                      <div className="p-3.5 bg-rose-50/20 border border-rose-100 rounded-xl">
                        <div className="flex justify-between items-center mb-2.5">
                          <h4 className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Break Slots Config</h4>
                          <button
                            type="button"
                            onClick={() => appendBreak({ start: '13:00', end: '14:00' })}
                            className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[9px] rounded flex items-center gap-0.5 transition-colors cursor-pointer"
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
                                className="w-full px-2.5 py-1 bg-white border border-slate-200 text-xs rounded-lg text-slate-800 focus:border-rose-500 focus:outline-none"
                                {...registerAvail(`breakSlots.${idx}.start` as any)}
                              />
                              <input
                                type="text"
                                placeholder="End e.g. 14:00"
                                className="w-full px-2.5 py-1 bg-white border border-slate-200 text-xs rounded-lg text-slate-800 focus:border-rose-500 focus:outline-none"
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
                        className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs transition-all shadow-md active:scale-[0.99] cursor-pointer"
                      >
                        {docAvailability ? 'Update Doctor Availability Schedule' : 'Create Doctor Availability Schedule'}
                      </button>
                    </form>
                  )
                )}
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT LOGS DISPLAY */}
          {activeTab === 'audits' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <h1 className="text-lg font-black text-slate-850">System Audit Records</h1>
                  <p className="text-slate-550 text-[11px] mt-0.5">Cryptographically logged system interaction trails.</p>
                </div>

                <div className="flex gap-2 w-full md:w-auto shrink-0">
                  <div className="relative flex-1 md:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search logs or email..."
                      value={auditSearchQuery}
                      onChange={(e) => setAuditSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-205 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none text-slate-800 text-xs rounded-xl"
                    />
                  </div>

                  <select
                    value={auditFilterStatus}
                    onChange={(e) => setAuditFilterStatus(e.target.value as any)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-205 text-slate-600 text-xs rounded-xl focus:border-rose-500 focus:outline-none"
                  >
                    <option value="all">All HTTP</option>
                    <option value="success">Success (2xx)</option>
                    <option value="error">Errors (&ge;400)</option>
                  </select>
                </div>
              </div>

              {/* Audit Table */}
              <div className="bg-white border border-slate-205 rounded-2xl overflow-hidden shadow-sm">
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
                          <tr key={log._id} className="hover:bg-rose-50/10 transition-colors">
                            <td className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap text-slate-500">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5">
                              <p className="font-bold text-slate-805 leading-tight">{log.userId?.name || 'Anonymous'}</p>
                              <span className="text-[9px] text-slate-450">{log.userId?.email || 'API client'}</span>
                            </td>
                            <td className="px-4 py-2.5 text-xs font-mono text-slate-600">
                              <span className={`px-1.5 py-0.5 rounded font-bold mr-2 text-[8px] ${
                                log.method === 'GET' ? 'bg-blue-50 text-blue-650 border border-blue-150' :
                                log.method === 'POST' ? 'bg-emerald-55 border border-emerald-150 text-emerald-700' :
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
                                  ? 'bg-emerald-55 border-emerald-200 text-emerald-700' 
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
        </>
      )}
    </DashboardLayout>
  );
};
export default AdminDashboard;
