import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { UserRole } from '../types/auth.types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  isPublicAuthRoute?: boolean; // True for /login and /register
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  isPublicAuthRoute = false,
}) => {
  const { isAuthenticated, role } = useAuthStore();
  const location = useLocation();

  const normalizedRole = role ? (
    role.toLowerCase() === 'doctor' ? 'Doctor' :
    role.toLowerCase() === 'admin' ? 'Admin' : 'Patient'
  ) : null;

  const getDashboardRoute = (userRole: UserRole | null): string => {
    switch (userRole) {
      case 'Patient':
        return '/patient/dashboard';
      case 'Doctor':
        return '/doctor/dashboard';
      case 'Admin':
        return '/admin/dashboard';
      default:
        return '/login';
    }
  };

  // 1. If user is authenticated and trying to access /login or /register, redirect to dashboard
  if (isAuthenticated && isPublicAuthRoute) {
    const from = (location.state as any)?.from?.pathname;
    return <Navigate to={from || getDashboardRoute(normalizedRole)} replace />;
  }

  // 2. If user is NOT authenticated and trying to access protected content, redirect to /login
  if (!isAuthenticated && !isPublicAuthRoute) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. If user is authenticated but doesn't have the required role, redirect to their role's dashboard
  if (isAuthenticated && allowedRoles && normalizedRole && !allowedRoles.includes(normalizedRole)) {
    return <Navigate to={getDashboardRoute(normalizedRole)} replace />;
  }

  return <>{children}</>;
};
export default ProtectedRoute;
