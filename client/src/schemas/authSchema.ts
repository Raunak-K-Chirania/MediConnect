import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z
  .object({
    name: z.string().min(1, 'Full name is required'),
    email: z.string().min(1, 'Email is required').email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    role: z.enum(['patient', 'doctor'], {
      message: 'Role is required',
    }),
    specialization: z.string().optional(),
    licenseNumber: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine(
    (data) => {
      if (data.role === 'doctor') {
        return !!data.specialization && data.specialization.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Specialization is required for doctors',
      path: ['specialization'],
    }
  )
  .refine(
    (data) => {
      if (data.role === 'doctor') {
        return !!data.licenseNumber && data.licenseNumber.trim().length > 0;
      }
      return true;
    },
    {
      message: 'License number is required for doctors',
      path: ['licenseNumber'],
    }
  );

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
