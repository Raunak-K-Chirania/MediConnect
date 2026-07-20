import React from 'react';
import { useAuthStore } from '../store/authStore';
import { LogOut, Activity, Stethoscope, Shield, Menu, X } from 'lucide-react';

interface SidebarItem {
  label: string;
  value: string;
  icon: React.ComponentType<any>;
  isEmergency?: boolean;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sidebarItems: SidebarItem[];
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  sidebarItems,
}) => {
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const getThemeColors = () => {
    switch (user?.role) {
      case 'Doctor':
        return {
          bg: 'bg-teal-50',
          border: 'border-teal-200',
          text: 'text-teal-600',
          activeItem: 'bg-teal-50 border-teal-300 text-teal-600 shadow-sm',
          badge: 'bg-teal-100 text-teal-700',
          glow: 'shadow-[0_4px_20px_rgba(20,184,166,0.08)]',
        };
      case 'Admin':
        return {
          bg: 'bg-rose-50',
          border: 'border-rose-200',
          text: 'text-rose-600',
          activeItem: 'bg-rose-50 border-rose-300 text-rose-600 shadow-sm',
          badge: 'bg-rose-100 text-rose-700',
          glow: 'shadow-[0_4px_20px_rgba(244,63,94,0.08)]',
        };
      default:
        return {
          bg: 'bg-indigo-50',
          border: 'border-indigo-200',
          text: 'text-indigo-600',
          activeItem: 'bg-indigo-50 border-indigo-300 text-indigo-600 shadow-sm',
          badge: 'bg-indigo-100 text-indigo-700',
          glow: 'shadow-[0_4px_20px_rgba(99,102,241,0.08)]',
        };
    }
  };

  const colors = getThemeColors();

  const getHeaderIcon = () => {
    switch (user?.role) {
      case 'Doctor':
        return <Stethoscope className="w-5 h-5 text-teal-500" />;
      case 'Admin':
        return <Shield className="w-5 h-5 text-rose-500" />;
      default:
        return <Activity className="w-5 h-5 text-indigo-500" />;
    }
  };

  const getPortalTitle = () => {
    switch (user?.role) {
      case 'Doctor':
        return 'Doctor Portal';
      case 'Admin':
        return 'Admin Portal';
      default:
        return 'Patient Portal';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col md:flex-row relative overflow-hidden">
      {/* Decorative background medical colored glows */}
      <div className={`absolute top-[-10%] left-[-10%] w-[35%] h-[35%] ${user?.role === 'Doctor' ? 'bg-teal-500/5' : user?.role === 'Admin' ? 'bg-rose-500/5' : 'bg-indigo-500/5'} rounded-full blur-[120px] pointer-events-none`} />
      <div className={`absolute bottom-[-10%] right-[-10%] w-[35%] h-[35%] ${user?.role === 'Doctor' ? 'bg-emerald-500/5' : user?.role === 'Admin' ? 'bg-pink-500/5' : 'bg-blue-500/5'} rounded-full blur-[120px] pointer-events-none`} />

      {/* Desktop Sidebar (narrowed for better page sizing) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 shrink-0 z-20">
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-slate-50 border border-slate-200 ${colors.glow}`}>
            {getHeaderIcon()}
          </div>
          <div>
            <h1 className="font-black text-sm tracking-tight text-slate-800">
              Medi<span className={colors.text}>Connect</span>
            </h1>
            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
              {user?.role} Console
            </span>
          </div>
        </div>

        {/* User Profile Info section */}
        <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-black text-sm border border-slate-300">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-800 truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>

        {/* Sidebar Nav items */}
        <nav className="flex-1 p-3.5 space-y-1">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.value;
            if (item.isEmergency) {
              return (
                <button
                  key={item.value}
                  onClick={() => setActiveTab(item.value)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-xs font-extrabold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-red-600 border-red-600 text-white shadow-md shadow-red-500/20'
                      : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100 animate-pulse'
                  }`}
                >
                  <Icon className="w-4.5 h-4.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            }

            return (
              <button
                key={item.value}
                onClick={() => setActiveTab(item.value)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? colors.activeItem
                    : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4.5 h-4.5 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout container at bottom */}
        <div className="p-3.5 border-t border-slate-100">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-4.5 h-4.5 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header Menu */}
      <header className="md:hidden w-full bg-white border-b border-slate-200 px-5 py-3.5 flex justify-between items-center z-20">
        <div className="flex items-center gap-2">
          {getHeaderIcon()}
          <span className="font-extrabold text-sm tracking-tight text-slate-800">{getPortalTitle()}</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-[53px] bg-white z-30 flex flex-col p-5 border-t border-slate-250 animate-fadeIn">
          <div className="flex items-center gap-3 mb-5 pb-5 border-b border-slate-100">
            <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>

          <nav className="flex-1 space-y-2">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.value;
              return (
                <button
                  key={item.value}
                  onClick={() => {
                    setActiveTab(item.value);
                    setMobileOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-xs font-bold transition-all duration-200 ${
                    isActive ? colors.activeItem : 'bg-transparent border-transparent text-slate-500'
                  }`}
                >
                  <Icon className="w-4.5 h-4.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-red-200 bg-red-50 text-red-600 rounded-xl text-xs font-bold mt-auto"
          >
            <LogOut className="w-4.5 h-4.5 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      )}

      {/* Main Content Container (narrower max-width and compact padding for page size control) */}
      <main className="flex-1 p-3 md:p-5 overflow-y-auto z-10 max-w-5xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
};
export default DashboardLayout;
