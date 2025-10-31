import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { SocketProvider } from './context/SocketContext';
import Landing from './pages/Landing';
import Menu from './pages/Menu';
import Waiter from './pages/Waiter';
import KOT from './pages/KOT';
import Admin from './pages/Admin';

function App() {
  return (
    <SocketProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/menu/:tableNumber" element={<Menu />} />
            <Route path="/waiter" element={<Waiter />} />
            <Route path="/kot" element={<KOT />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
          <Toaster 
            position="top-right"
            toastOptions={{
              className: 'font-medium',
              duration: 3000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                iconTheme: {
                  primary: '#4ade80',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </div>
      </Router>
    </SocketProvider>
  );
}

export default App;