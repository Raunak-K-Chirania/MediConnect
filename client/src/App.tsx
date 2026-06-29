import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import VideoCallPage from './pages/VideoCallPage';

export const App: React.FC = () => {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route
        path="/login"
        element={
          <ProtectedRoute isPublicAuthRoute>
            <Login />
          </ProtectedRoute>
        }
      />
      <Route
        path="/register"
        element={
          <ProtectedRoute isPublicAuthRoute>
            <Register />
          </ProtectedRoute>
        }
      />

      {/* Protected Dashboards */}
      <Route
        path="/patient/dashboard"
        element={
          <ProtectedRoute allowedRoles={['Patient']}>
            <PatientDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor/dashboard"
        element={
          <ProtectedRoute allowedRoles={['Doctor']}>
            <DoctorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/video-call/:roomId"
        element={
          <ProtectedRoute allowedRoles={['Patient', 'Doctor']}>
            <VideoCallPage />
          </ProtectedRoute>
        }
      />

      {/* Redirect all other routes */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default App;
