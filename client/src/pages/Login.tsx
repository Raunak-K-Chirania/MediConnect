import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Activity, AlertCircle, CheckCircle2, Video, Clipboard, Calendar } from 'lucide-react';
import { loginSchema, LoginInput } from '../schemas/authSchema';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Preserve intended destination path after login
  const from = (location.state as any)?.from?.pathname;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loginMutation = useMutation({
    mutationFn: authService.login,
    onSuccess: (data) => {
      setSuccessMessage('Login successful! Redirecting...');
      setErrorMessage(null);
      
      // Update state in Zustand store
      login(data.user, data.token);

      // Redirect based on role
      setTimeout(() => {
        if (from) {
          navigate(from, { replace: true });
        } else {
          const role = data.user.role;
          if (role === 'Patient') {
            navigate('/patient/dashboard');
          } else if (role === 'Doctor') {
            navigate('/doctor/dashboard');
          } else if (role === 'Admin') {
            navigate('/admin/dashboard');
          } else {
            navigate('/login');
          }
        }
      }, 1500);
    },
    onError: (error: any) => {
      setSuccessMessage(null);
      const apiError = error?.response?.data?.error || error?.response?.data?.message || 'Invalid credentials or network error';
      setErrorMessage(apiError);
    },
  });

  const onSubmit = (data: LoginInput) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-tr from-sky-100 via-slate-50 to-teal-50 px-4 py-3 relative overflow-hidden font-sans">
      {/* Colorful decorative background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-teal-400/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-400/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-5%] w-[30%] h-[30%] bg-sky-400/15 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="w-full max-w-4xl bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12 z-10">
        
        {/* Left Side: Brand presentation (takes 5 columns) */}
        <div className="md:col-span-5 bg-gradient-to-br from-teal-500 via-sky-600 to-indigo-600 p-6 flex flex-col justify-between text-white relative overflow-hidden">
          {/* Subtle background overlay */}
          <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
          <div className="absolute bottom-[-20%] left-[-20%] w-[60%] h-[60%] bg-teal-400/20 rounded-full blur-[60px]" />
          
          <div className="relative z-10 space-y-4">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 backdrop-blur-sm p-0.5 rounded-lg flex items-center justify-center shadow-sm">
                <div className="w-full h-full bg-white rounded-[5px] flex items-center justify-center text-teal-600">
                  <Activity className="w-5 h-5 text-sky-500" />
                </div>
              </div>
              <h1 className="text-xl font-black tracking-tight font-display">
                MediConnect
              </h1>
            </div>
            
            {/* Title / Description */}
            <div className="space-y-1">
              <h2 className="text-lg font-bold tracking-tight leading-tight">
                Modern Telemedicine Platform
              </h2>
              <p className="text-[11px] text-sky-100 leading-relaxed">
                MediConnect bridges the gap between patients and healthcare providers, offering seamless appointment scheduling, medical records management, and virtual consultations.
              </p>
            </div>
            
            {/* Detail Bullet Points */}
            <div className="space-y-2 pt-1">
              <div className="flex items-start gap-2">
                <div className="w-4.5 h-4.5 bg-white/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <Video className="w-2.5 h-2.5 text-sky-200" />
                </div>
                <div>
                  <h3 className="text-[11px] font-bold text-white">Virtual Consultations</h3>
                  <p className="text-[9px] text-sky-100">Connect with specialists online from any device securely.</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-4.5 h-4.5 bg-white/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <Clipboard className="w-2.5 h-2.5 text-sky-200" />
                </div>
                <div>
                  <h3 className="text-[11px] font-bold text-white">Decrypted Health Records</h3>
                  <p className="text-[9px] text-sky-100">Access your fully encrypted EHR and clinical SOAP notes securely.</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-4.5 h-4.5 bg-white/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <Calendar className="w-2.5 h-2.5 text-sky-200" />
                </div>
                <div>
                  <h3 className="text-[11px] font-bold text-white">Smart Scheduling</h3>
                  <p className="text-[9px] text-sky-100">Real-time availability updates to book, cancel, or reschedule slots.</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Trust Badge at bottom */}
          <div className="relative z-10 pt-3 border-t border-white/10 text-[9px] text-sky-200 flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Encrypted patient-doctor EHR data</span>
          </div>
        </div>
        
        {/* Right Side: Form panel (takes 7 columns) */}
        <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-center bg-white">
          <div className="max-w-sm w-full mx-auto">
            <h2 className="text-base font-black text-slate-800 tracking-tight">Welcome Back</h2>
            <p className="text-[11px] text-slate-400 mt-0.5 mb-4">Sign in to access your dashboard</p>

            {/* Error Alert */}
            {errorMessage && (
              <div className="mb-3 p-2 bg-red-50 border border-red-100 text-red-800 text-[10px] rounded-lg flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                <span className="font-semibold">{errorMessage}</span>
              </div>
            )}

            {/* Success Alert */}
            {successMessage && (
              <div className="mb-3 p-2 bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] rounded-lg flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span className="font-semibold">{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
              {/* Email field */}
              <div>
                <label htmlFor="email" className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    disabled={loginMutation.isPending}
                    className={`w-full pl-8 pr-2.5 py-1.5 bg-slate-50/50 border ${
                      errors.email ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : 'border-slate-200 focus:border-sky-500 focus:ring-sky-100'
                    } focus:outline-none focus:ring-1 text-slate-800 rounded-lg text-xs transition-all placeholder-slate-400`}
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <p className="mt-0.5 text-[8px] text-red-500 flex items-center gap-0.5 font-medium">
                    <AlertCircle className="w-3 h-3" />
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password field */}
              <div>
                <label htmlFor="password" className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    disabled={loginMutation.isPending}
                    className={`w-full pl-8 pr-8 py-1.5 bg-slate-50/50 border ${
                      errors.password ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : 'border-slate-200 focus:border-sky-500 focus:ring-sky-100'
                    } focus:outline-none focus:ring-1 text-slate-800 rounded-lg text-xs transition-all placeholder-slate-400`}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-650 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-0.5 text-[8px] text-red-500 flex items-center gap-0.5 font-medium">
                    <AlertCircle className="w-3 h-3" />
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full flex items-center justify-center py-1.5 px-3 border border-transparent text-xs font-bold rounded-lg text-white bg-gradient-to-r from-teal-500 via-sky-500 to-indigo-600 hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md mt-3"
              >
                {loginMutation.isPending ? (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Logging in...</span>
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Footer Link */}
            <div className="mt-4 pt-3 border-t border-slate-100 text-center text-xs text-slate-500 font-medium">
              Don't have an account?{' '}
              <Link to="/register" className="font-bold text-indigo-600 hover:text-indigo-500 hover:underline transition-all">
                Register here
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
export default Login;