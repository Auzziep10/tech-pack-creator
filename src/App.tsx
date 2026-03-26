import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { CreateTechPack } from './pages/CreateTechPack';
import { TechPackEditor } from './pages/TechPackEditor';
import { MobileScanner } from './pages/MobileScanner';
import { ComboLineSheet } from './pages/ComboLineSheet';
import { Login } from './pages/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/scan/:sessionId" element={<MobileScanner />} />
          
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/create" element={<ProtectedRoute><CreateTechPack /></ProtectedRoute>} />
          <Route path="/pack/:id" element={<ProtectedRoute><TechPackEditor /></ProtectedRoute>} />
          <Route path="/combo-linesheet" element={<ProtectedRoute><ComboLineSheet /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
