import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, Activity, AlertCircle, CheckCircle2, Stethoscope, FileText, Check, X, Video, Calendar } from 'lucide-react';
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
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-tr from-sky-100 via-slate-50 to-teal-50 px-4 py-3 relative overflow-hidden font-sans">
      {/* Colorful decorative background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-400/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-teal-400/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-5%] w-[30%] h-[30%] bg-sky-400/15 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-4xl bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12 z-10">
        
        {/* Left Side: Brand presentation (takes 5 columns) */}
        <div className="md:col-span-5 bg-gradient-to-br from-indigo-500 via-indigo-700 to-teal-600 p-6 flex flex-col justify-between text-white relative overflow-hidden">
          {/* Subtle background overlay */}
          <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
          <div className="absolute bottom-[-20%] left-[-20%] w-[60%] h-[60%] bg-indigo-400/20 rounded-full blur-[60px]" />
          
          <div className="relative z-10 space-y-4">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 backdrop-blur-sm p-0.5 rounded-lg flex items-center justify-center shadow-sm">
                <div className="w-full h-full bg-white rounded-[5px] flex items-center justify-center text-indigo-650">
                  <Activity className="w-5 h-5 text-indigo-500" />
                </div>
              </div>
              <h1 className="text-xl font-black tracking-tight font-display">
                MediConnect
              </h1>
            </div>
            
            {/* Title / Description */}
            <div className="space-y-1">
              <h2 className="text-lg font-bold tracking-tight leading-tight">
                Create Your Account
              </h2>
              <p className="text-[11px] text-indigo-100 leading-relaxed">
                Unlock specialized patient portals, consult directly with board-certified physicians, and manage electronic health history reports effortlessly.
              </p>
            </div>
            
            {/* Detail Bullet Points */}
            <div className="space-y-2 pt-1">
              <div className="flex items-start gap-2">
                <div className="w-4.5 h-4.5 bg-white/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-2.5 h-2.5 text-indigo-200" />
                </div>
                <div>
                  <h3 className="text-[11px] font-bold text-white">For Patients</h3>
                  <p className="text-[9px] text-indigo-100">Schedule real-time visits, video consults, and manage medical files.</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-4.5 h-4.5 bg-white/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <Stethoscope className="w-2.5 h-2.5 text-indigo-200" />
                </div>
                <div>
                  <h3 className="text-[11px] font-bold text-white">For Medical Providers</h3>
                  <p className="text-[9px] text-indigo-100">Publish calendars, configure slot intervals, and write digital SOAP reports.</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-4.5 h-4.5 bg-white/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="w-2.5 h-2.5 text-indigo-200" />
                </div>
                <div>
                  <h3 className="text-[11px] font-bold text-white">Secure Encrypted Database</h3>
                  <p className="text-[9px] text-indigo-100">Personal metadata and EHR logs are stored fully encrypted.</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Trust Badge at bottom */}
          <div className="relative z-10 pt-3 border-t border-white/10 text-[9px] text-indigo-200 flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>HIPAA-aligned security protocols</span>
          </div>
        </div>
        
        {/* Right Side: Form panel (takes 7 columns) */}
        <div className="md:col-span-7 p-5 sm:p-6 flex flex-col justify-center bg-white">
          <div className="w-full mx-auto">
            <h2 className="text-base font-black text-slate-800 tracking-tight">Create New Account</h2>
            <p className="text-[11px] text-slate-400 mt-0.5 mb-3">Register to start using telemedicine services</p>

            {/* Error Alert */}
            {errorMessage && (
              <div className="mb-2 p-1.5 bg-red-50 border border-red-100 text-red-800 text-[9px] rounded-lg flex items-start gap-1">
                <AlertCircle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                <span className="font-semibold">{errorMessage}</span>
              </div>
            )}

            {/* Success Alert */}
            {successMessage && (
              <div className="mb-2 p-1.5 bg-emerald-50 border border-emerald-100 text-emerald-800 text-[9px] rounded-lg flex items-start gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                <span className="font-semibold">{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-1.5">
              {/* Role Switcher */}
              <div>
                <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                  Registering As
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setValue('role', 'patient')}
                    className={`flex items-center justify-center gap-1 py-1 px-2.5 rounded-lg border text-center transition-all duration-200 cursor-pointer ${
                      selectedRole === 'patient'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-600 font-bold shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-slate-300'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Patient</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setValue('role', 'doctor')}
                    className={`flex items-center justify-center gap-1 py-1 px-2.5 rounded-lg border text-center transition-all duration-200 cursor-pointer ${
                      selectedRole === 'doctor'
                        ? 'bg-teal-50 border-teal-300 text-teal-600 font-bold shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-teal-600 hover:border-slate-300'
                    }`}
                  >
                    <Stethoscope className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Doctor</span>
                  </button>
                </div>
              </div>

              {/* Name & Email grid */}
              <div className="grid grid-cols-2 gap-2">
                {/* Name field */}
                <div>
                  <label htmlFor="name" className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-slate-400">
                      <User className="w-3 h-3" />
                    </div>
                    <input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      disabled={registerMutation.isPending}
                      className={`w-full pl-7 pr-2 py-1 bg-slate-50/50 border ${
                        errors.name ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-sky-500'
                      } focus:outline-none focus:ring-1 focus:ring-sky-100 text-slate-800 rounded-lg text-xs transition-all placeholder-slate-400`}
                      {...register('name')}
                    />
                  </div>
                  {errors.name && (
                    <p className="mt-0.5 text-[8px] text-red-500 flex items-center gap-0.5 font-medium">
                      <AlertCircle className="w-2.5 h-2.5" />
                      {errors.name.message}
                    </p>
                  )}
                </div>

                {/* Email field */}
                <div>
                  <label htmlFor="email" className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-3 h-3" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      disabled={registerMutation.isPending}
                      className={`w-full pl-7 pr-2 py-1 bg-slate-50/50 border ${
                        errors.email ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-sky-500'
                      } focus:outline-none focus:ring-1 focus:ring-sky-100 text-slate-800 rounded-lg text-xs transition-all placeholder-slate-400`}
                      {...register('email')}
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-0.5 text-[8px] text-red-500 flex items-center gap-0.5 font-medium">
                      <AlertCircle className="w-2.5 h-2.5" />
                      {errors.email.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Doctor-Specific Fields (Conditional) */}
              {selectedRole === 'doctor' && (
                <div className="grid grid-cols-2 gap-2 pt-0.5 animate-fadeIn">
                  <div>
                    <label htmlFor="specialization" className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                      Specialization
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-slate-400">
                        <Stethoscope className="w-3.5 h-3.5" />
                      </div>
                      <input
                        id="specialization"
                        type="text"
                        placeholder="Cardiology"
                        disabled={registerMutation.isPending}
                        className={`w-full pl-7 pr-2 py-1 bg-slate-50/50 border ${
                          errors.specialization ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-teal-500'
                        } focus:outline-none focus:ring-1 focus:ring-teal-50 text-slate-800 rounded-lg text-xs transition-all placeholder-slate-400`}
                        {...register('specialization')}
                      />
                    </div>
                    {errors.specialization && (
                      <p className="mt-0.5 text-[8px] text-red-500 flex items-center gap-0.5 font-medium">
                        <AlertCircle className="w-2.5 h-2.5" />
                        {errors.specialization.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="licenseNumber" className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                      License Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-slate-400">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <input
                        id="licenseNumber"
                        type="text"
                        placeholder="LIC-12345"
                        disabled={registerMutation.isPending}
                        className={`w-full pl-7 pr-2 py-1 bg-slate-50/50 border ${
                          errors.licenseNumber ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-teal-500'
                        } focus:outline-none focus:ring-1 focus:ring-teal-50 text-slate-800 rounded-lg text-xs transition-all placeholder-slate-400`}
                        {...register('licenseNumber')}
                      />
                    </div>
                    {errors.licenseNumber && (
                      <p className="mt-0.5 text-[8px] text-red-500 flex items-center gap-0.5 font-medium">
                        <AlertCircle className="w-2.5 h-2.5" />
                        {errors.licenseNumber.message}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Password & Confirm Password Grid */}
              <div className="grid grid-cols-2 gap-2">
                {/* Password field */}
                <div>
                  <label htmlFor="password" className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-3 h-3" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      disabled={registerMutation.isPending}
                      className={`w-full pl-7 pr-7 py-1 bg-slate-50/50 border ${
                        errors.password ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-sky-500'
                      } focus:outline-none focus:ring-1 focus:ring-sky-100 text-slate-800 rounded-lg text-xs transition-all placeholder-slate-400`}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-0.5 text-[8px] text-red-500 flex items-center gap-0.5 font-medium">
                      <AlertCircle className="w-2.5 h-2.5" />
                      {errors.password.message}
                    </p>
                  )}
                </div>

                {/* Confirm Password field */}
                <div>
                  <label htmlFor="confirmPassword" className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-3 h-3" />
                    </div>
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      disabled={registerMutation.isPending}
                      className={`w-full pl-7 pr-7 py-1 bg-slate-50/50 border ${
                        errors.confirmPassword ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-sky-500'
                      } focus:outline-none focus:ring-1 focus:ring-sky-100 text-slate-800 rounded-lg text-xs transition-all placeholder-slate-400`}
                      {...register('confirmPassword')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-0.5 text-[8px] text-red-500 flex items-center gap-0.5 font-medium">
                      <AlertCircle className="w-2.5 h-2.5" />
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Password strength checklist (2-column layout) */}
              <div className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-2 gap-x-2 gap-y-0.5 text-[8.5px] text-slate-500 leading-relaxed font-sans">
                <div className="col-span-2 font-bold text-[7.5px] uppercase text-slate-400 tracking-wider mb-0.5">
                  Password Requirements
                </div>
                <div className="flex items-center gap-0.5">
                  {criteria.length ? (
                    <Check className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                  ) : (
                    <X className="w-2.5 h-2.5 text-slate-300 shrink-0" />
                  )}
                  <span className={criteria.length ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  {criteria.uppercase ? (
                    <Check className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                  ) : (
                    <X className="w-2.5 h-2.5 text-slate-300 shrink-0" />
                  )}
                  <span className={criteria.uppercase ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                    One uppercase (A-Z)
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  {criteria.lowercase ? (
                    <Check className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                  ) : (
                    <X className="w-2.5 h-2.5 text-slate-300 shrink-0" />
                  )}
                  <span className={criteria.lowercase ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                    One lowercase (a-z)
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  {criteria.number ? (
                    <Check className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                  ) : (
                    <X className="w-2.5 h-2.5 text-slate-300 shrink-0" />
                  )}
                  <span className={criteria.number ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                    One number (0-9)
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  {criteria.special ? (
                    <Check className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                  ) : (
                    <X className="w-2.5 h-2.5 text-slate-300 shrink-0" />
                  )}
                  <span className={criteria.special ? 'text-slate-700 font-medium' : 'text-slate-400'}>
                    One symbol (!@#$)
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={registerMutation.isPending}
                className={`w-full flex items-center justify-center py-1 px-3 border border-transparent text-xs font-bold rounded-lg text-white transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md mt-2 ${
                  selectedRole === 'doctor'
                    ? 'bg-gradient-to-r from-teal-500 to-emerald-600 hover:opacity-95'
                    : 'bg-gradient-to-r from-indigo-500 to-sky-600 hover:opacity-95'
                }`}
              >
                {registerMutation.isPending ? (
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Registering...</span>
                  </div>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            {/* Footer Link */}
            <div className="mt-2 pt-2 border-t border-slate-100 text-center text-xs text-slate-500 font-medium">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-indigo-600 hover:text-indigo-500 hover:underline transition-all">
                Sign in here
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
export default Register;


