import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import Vendors from './pages/Vendors';
import MilkCollection from './pages/MilkCollection';
import Customers from './pages/Customers';
import BottleTracking from './pages/BottleTracking';
import Deliveries from './pages/Deliveries';
import Invoice from './pages/Invoice';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="main-content">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
          <Routes>
            <Route path="/"                       element={<Dashboard />} />
            <Route path="/vendors"                element={<Vendors />} />
            <Route path="/customers"              element={<Customers />} />
            <Route path="/milk-collection"        element={<MilkCollection />} />
            <Route path="/bottle-tracking"        element={<BottleTracking />} />
            <Route path="/deliveries"             element={<Deliveries />} />
            <Route path="/invoice/:customerId"    element={<Invoice />} />
          </Routes>
        </div>
      </div>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid #334155',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#1e293b' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#1e293b' },
          },
        }}
      />
    </BrowserRouter>
  );
}
