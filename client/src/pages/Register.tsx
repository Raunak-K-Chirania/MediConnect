import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, Activity, AlertCircle, CheckCircle2, Stethoscope, FileText, Check, X } from 'lucide-react';
import { registerSchema, RegisterInput } from '../schemas/authSchema';
import { authService } from '../services/authService';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'patient',
      specialization: '',
      licenseNumber: '',
    },
  });

  const selectedRole = watch('role');
  const password = watch('password', '');

  // Password complexity helper checks
  const criteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const registerMutation = useMutation({
    mutationFn: authService.register,
    onSuccess: () => {
      setSuccessMessage('Registration successful! Redirecting to login page...');
      setErrorMessage(null);
      
      // Redirect to login page
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    },
    onError: (error: any) => {
      setSuccessMessage(null);
      const apiError = error?.response?.data?.error || error?.response?.data?.message || 'Registration failed. Please try again.';
      setErrorMessage(apiError);
    },
  });

  const onSubmit = (data: RegisterInput) => {
    // If patient, clean up optional fields
    if (data.role === 'patient') {
      delete data.specialization;
      delete data.licenseNumber;
    }
    registerMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 bg-radial-glow px-4 py-12 relative overflow-hidden font-sans">
      {/* Decorative background components */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-600/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-lg z-10 my-8">
        {/* Brand Logo & Header */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-14 h-14 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center mb-3 text-indigo-400 text-glow shadow-[0_0_20px_rgba(99,102,241,0.2)] animate-pulse">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-display">
            Medi<span className="text-indigo-400">Connect</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Create your account to start consults
          </p>
        </div>

        {/* Card Body */}
        <div className="bg-slate-950/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6">Create New Account</h2>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-950/40 border border-red-800/60 text-red-200 text-sm rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Alert */}
          {successMessage && (
            <div className="mb-6 p-4 bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-sm rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Role Switcher */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Registering As
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setValue('role', 'patient')}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                    selectedRole === 'patient'
                      ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400'
                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <User className="w-6 h-6 mb-2" />
                  <span className="text-sm font-bold">Patient</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => setValue('role', 'doctor')}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                    selectedRole === 'doctor'
                      ? 'bg-teal-500/10 border-teal-500 text-teal-400'
                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Stethoscope className="w-6 h-6 mb-2" />
                  <span className="text-sm font-bold">Doctor</span>
                </button>
              </div>
            </div>

            {/* Name field */}
            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-5 h-5" />
                </div>
                <input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  disabled={registerMutation.isPending}
                  className={`w-full pl-11 pr-4 py-3 bg-slate-900 border ${
                    errors.name ? 'border-red-500/80 focus:border-red-500' : 'border-slate-800 focus:border-indigo-500/80'
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-white rounded-xl text-sm transition-all placeholder-slate-600`}
                  {...register('name')}
                />
              </div>
              {errors.name && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.name.message}
                </p>
              )}
            </div>

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
                  disabled={registerMutation.isPending}
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

            {/* Doctor-Specific Fields (Conditional) */}
            {selectedRole === 'doctor' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 animate-fadeIn">
                <div>
                  <label htmlFor="specialization" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Specialization
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    <input
                      id="specialization"
                      type="text"
                      placeholder="e.g., Cardiology"
                      disabled={registerMutation.isPending}
                      className={`w-full pl-11 pr-4 py-3 bg-slate-900 border ${
                        errors.specialization ? 'border-red-500/80 focus:border-red-500' : 'border-slate-800 focus:border-teal-500/80'
                      } focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-white rounded-xl text-sm transition-all placeholder-slate-600`}
                      {...register('specialization')}
                    />
                  </div>
                  {errors.specialization && (
                    <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.specialization.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="licenseNumber" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    License Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <FileText className="w-5 h-5" />
                    </div>
                    <input
                      id="licenseNumber"
                      type="text"
                      placeholder="e.g., LIC-12345"
                      disabled={registerMutation.isPending}
                      className={`w-full pl-11 pr-4 py-3 bg-slate-900 border ${
                        errors.licenseNumber ? 'border-red-500/80 focus:border-red-500' : 'border-slate-800 focus:border-teal-500/80'
                      } focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-white rounded-xl text-sm transition-all placeholder-slate-600`}
                      {...register('licenseNumber')}
                    />
                  </div>
                  {errors.licenseNumber && (
                    <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.licenseNumber.message}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Password field */}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  disabled={registerMutation.isPending}
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

              {/* Password strength checklist */}
              <div className="mt-3 p-3 bg-slate-900/50 border border-slate-900 rounded-xl space-y-1.5 text-xs text-slate-400">
                <div className="font-semibold text-[10px] uppercase text-slate-500 tracking-wider mb-1">
                  Password Requirements
                </div>
                <div className="flex items-center gap-2">
                  {criteria.length ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                  <span className={criteria.length ? 'text-slate-300' : 'text-slate-500'}>
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {criteria.uppercase ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                  <span className={criteria.uppercase ? 'text-slate-300' : 'text-slate-500'}>
                    At least one uppercase letter (A-Z)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {criteria.lowercase ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                  <span className={criteria.lowercase ? 'text-slate-300' : 'text-slate-500'}>
                    At least one lowercase letter (a-z)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {criteria.number ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                  <span className={criteria.number ? 'text-slate-300' : 'text-slate-500'}>
                    At least one number (0-9)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {criteria.special ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                  <span className={criteria.special ? 'text-slate-300' : 'text-slate-500'}>
                    At least one special character (!@#$%^&*)
                  </span>
                </div>
              </div>
            </div>

            {/* Confirm Password field */}
            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  disabled={registerMutation.isPending}
                  className={`w-full pl-11 pr-11 py-3 bg-slate-900 border ${
                    errors.confirmPassword ? 'border-red-500/80 focus:border-red-500' : 'border-slate-800 focus:border-indigo-500/80'
                  } focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-white rounded-xl text-sm transition-all placeholder-slate-600`}
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={registerMutation.isPending}
              className={`w-full flex items-center justify-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg mt-6 ${
                selectedRole === 'doctor'
                  ? 'bg-teal-600 hover:bg-teal-500 focus:ring-teal-500 shadow-teal-600/25'
                  : 'bg-indigo-600 hover:bg-indigo-500 focus:ring-indigo-500 shadow-indigo-600/25'
              }`}
            >
              {registerMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Registering...</span>
                </div>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Footer Link */}
          <div className="mt-8 pt-6 border-t border-slate-900 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-indigo-400 hover:text-indigo-300 hover:underline transition-all">
              Sign in here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Register;
