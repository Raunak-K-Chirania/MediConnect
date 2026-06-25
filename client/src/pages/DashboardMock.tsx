import React from 'react';
import { useAuthStore } from '../store/authStore';
import { LogOut, Activity, Shield, Stethoscope } from 'lucide-react';

export const PatientDashboard: React.FC = () => {
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col">
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-indigo-400 animate-pulse" />
          <span className="font-bold text-lg">MediConnect Patient Portal</span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 rounded-lg text-sm text-slate-300 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </header>

      <main className="flex-1 p-8 max-w-4xl mx-auto w-full">
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl mb-6">
          <h1 className="text-2xl font-bold mb-2">Welcome, {user?.name}!</h1>
          <p className="text-slate-400 text-sm">Patient Dashboard</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Email</div>
              <div className="text-slate-300">{user?.email}</div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Role</div>
              <div className="text-indigo-400 font-bold">{user?.role}</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export const DoctorDashboard: React.FC = () => {
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col">
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-6 h-6 text-teal-400 animate-pulse" />
          <span className="font-bold text-lg">MediConnect Doctor Console</span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 rounded-lg text-sm text-slate-300 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </header>

      <main className="flex-1 p-8 max-w-4xl mx-auto w-full">
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl mb-6">
          <h1 className="text-2xl font-bold mb-2">Welcome, Dr. {user?.name}!</h1>
          <p className="text-slate-400 text-sm">Doctor Console</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Email</div>
              <div className="text-slate-300">{user?.email}</div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Role</div>
              <div className="text-teal-400 font-bold">{user?.role}</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col">
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-red-400 animate-pulse" />
          <span className="font-bold text-lg">MediConnect Administration</span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 rounded-lg text-sm text-slate-300 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </header>

      <main className="flex-1 p-8 max-w-4xl mx-auto w-full">
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl mb-6">
          <h1 className="text-2xl font-bold mb-2">Welcome, Admin {user?.name}!</h1>
          <p className="text-slate-400 text-sm">System Administration Dashboard</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Email</div>
              <div className="text-slate-300">{user?.email}</div>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Role</div>
              <div className="text-red-400 font-bold">{user?.role}</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
