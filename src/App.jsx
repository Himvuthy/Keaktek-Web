import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import PhoneSignUp from './pages/PhoneSignUp';
import ParentLogin from './pages/ParentLogin';
import ParentRegister from './pages/ParentRegister';
import ParentPhoneSignUp from './pages/ParentPhoneSignUp';
import ParentConnect from './pages/ParentConnect';
import ProfileSetup from './pages/ProfileSetup';
import AdminDashboard from './pages/AdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import './index.css';

function App() {
  return (
    <BrowserRouter basename={import.meta.env.DEV ? "/" : "/Keaktek-Web/"}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/phone-signup" element={<PhoneSignUp />} />
        <Route path="/parent-login" element={<ParentLogin />} />
        <Route path="/parent-register" element={<ParentRegister />} />
        <Route path="/parent-phone-signup" element={<ParentPhoneSignUp />} />
        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/parent-connect" element={<ParentConnect />} />
          <Route path="/profile-setup" element={<ProfileSetup />} />
          <Route path="/dashboard" element={<AdminDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
