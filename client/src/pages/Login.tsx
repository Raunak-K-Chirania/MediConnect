import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center bg-slate-900 bg-radial-glow px-4 py-12 relative overflow-hidden font-sans">
      {/* Decorative background components */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
      
      <div className="w-full max-w-md z-10">
        {/* Brand Logo & Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-14 h-14 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center mb-3 text-indigo-400 text-glow shadow-[0_0_20px_rgba(99,102,241,0.2)] animate-pulse">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-display">
            Medi<span className="text-indigo-400">Connect</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Secure Access to Telemedicine Services
          </p>
        </div>

        {/* Card Body */}
        <div className="bg-slate-950/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6">Welcome Back</h2>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mb-5 p-4 bg-red-950/40 border border-red-800/60 text-red-200 text-sm rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Alert */}
          {successMessage && (
            <div className="mb-5 p-4 bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-sm rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email field */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  disabled={loginMutation.isPending}
                  className={`w-full pl-11 pr-4 py-3 bg-slate-900 border ${
                    errors.email ? 'border-red-500/80 focus:border-red-500' : 'border-slate-800 focus:border-indigo-500/80'
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-white rounded-xl text-sm transition-all placeholder-slate-600`}
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password field */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  disabled={loginMutation.isPending}
                  className={`w-full pl-11 pr-11 py-3 bg-slate-900 border ${
                    errors.password ? 'border-red-500/80 focus:border-red-500' : 'border-slate-800 focus:border-indigo-500/80'
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-white rounded-xl text-sm transition-all placeholder-slate-600`}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full flex items-center justify-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 focus:ring-indigo-500 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-[0_4px_20px_rgba(99,102,241,0.3)] mt-6"
            >
              {loginMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Logging in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-8 pt-6 border-t border-slate-900 text-center text-sm text-slate-400">
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-indigo-400 hover:text-indigo-300 hover:underline transition-all">
              Register here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Login;
