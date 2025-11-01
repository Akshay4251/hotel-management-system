import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Hash, Users, ChefHat, Shield, Utensils, X, ArrowLeft } from 'lucide-react';
import { tablesAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Html5QrcodeScanner } from 'html5-qrcode';

function Landing() {
  const [tableNumber, setTableNumber] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Initialize QR Scanner
  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
        },
        false
      );

      scanner.render(onScanSuccess, onScanError);

      return () => {
        scanner.clear().catch(error => {
          console.error("Failed to clear scanner:", error);
        });
      };
    }
  }, [showScanner]);

  const onScanSuccess = async (decodedText) => {
    console.log('✅ QR Scanned:', decodedText);
    
    let tableNum;
    
    try {
      // Try parsing as URL first
      const url = new URL(decodedText);
      const pathParts = url.pathname.split('/');
      tableNum = pathParts[pathParts.length - 1];
    } catch {
      // Not a URL, treat as direct table number
      tableNum = decodedText.trim();
    }

    if (tableNum && !isNaN(tableNum)) {
      setLoading(true);
      try {
        const response = await tablesAPI.verify(tableNum);
        if (response.data.success) {
          // Navigate directly
          navigate(`/menu/${tableNum}`);
        }
      } catch (error) {
        toast.error('Invalid table number');
        setLoading(false);
      }
    } else {
      toast.error('Invalid QR code');
    }
  };

  const onScanError = (errorMessage) => {
    // Silently ignore scan errors (camera is searching)
  };

  const handleTableSubmit = async (e) => {
    e.preventDefault();
    if (!tableNumber) {
      toast.error('Please enter table number');
      return;
    }

    setLoading(true);
    try {
      const response = await tablesAPI.verify(tableNumber);
      
      if (response.data.success) {
        navigate(`/menu/${tableNumber}`);
      }
    } catch (error) {
      toast.error('Invalid table number');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenScanner = () => {
    setShowScanner(true);
    setShowInput(false);
  };

  const handleCloseScanner = () => {
    setShowScanner(false);
  };

  // Show scanner view
  if (showScanner) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        {/* Header */}
        <div className="bg-white px-4 py-3 flex items-center justify-between shadow-lg">
          <button
            onClick={handleCloseScanner}
            className="flex items-center gap-2 text-gray-700 hover:text-red-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
          <h3 className="text-lg font-bold text-gray-900">Scan QR Code</h3>
          <div className="w-16"></div> {/* Spacer for centering */}
        </div>

        {/* Scanner */}
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div 
              id="qr-reader" 
              className="w-full rounded-xl overflow-hidden shadow-2xl"
            ></div>
            
            {loading && (
              <div className="mt-6 flex items-center justify-center gap-3 bg-white px-6 py-4 rounded-xl shadow-lg">
                <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-medium text-gray-700">Verifying table...</span>
              </div>
            )}

            {!loading && (
              <div className="mt-6 p-4 bg-white bg-opacity-90 rounded-xl text-center">
                <p className="text-sm text-gray-700 font-medium">
                  📱 Point camera at table QR code
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Manual Entry Footer */}
        <div className="bg-white px-4 py-4 border-t">
          <button
            onClick={() => {
              setShowScanner(false);
              setShowInput(true);
            }}
            className="w-full text-sm text-gray-600 hover:text-red-600 transition-colors font-medium"
          >
            Can't scan? Enter table number manually →
          </button>
        </div>
      </div>
    );
  }

  // Main landing page
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-600">
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-4 shadow-lg">
              <Utensils className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-2">
              Restaurant
            </h1>
            <p className="text-lg text-white opacity-90">
              Order delicious food
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
              Get Started
            </h2>

            {/* Options */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button 
                className="p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all border-2 border-transparent hover:border-red-200 active:scale-95"
                onClick={handleOpenScanner}
              >
                <div className="flex flex-col items-center space-y-3">
                  <div className="p-3 bg-white rounded-full shadow-md">
                    <QrCode className="w-8 h-8 text-red-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Scan QR</span>
                </div>
              </button>

              <button 
                onClick={() => {
                  setShowInput(!showInput);
                  setShowScanner(false);
                }}
                className={`p-6 rounded-xl transition-all border-2 active:scale-95 ${
                  showInput 
                    ? 'bg-red-600 text-white border-red-600' 
                    : 'bg-gray-50 hover:bg-gray-100 border-transparent hover:border-red-200'
                }`}
              >
                <div className="flex flex-col items-center space-y-3">
                  <div className={`p-3 rounded-full shadow-md ${
                    showInput ? 'bg-white bg-opacity-20' : 'bg-white'
                  }`}>
                    <Hash className={`w-8 h-8 ${showInput ? 'text-white' : 'text-red-600'}`} />
                  </div>
                  <span className="text-sm font-semibold">Table No</span>
                </div>
              </button>
            </div>

            {/* Table Input */}
            {showInput && (
              <form onSubmit={handleTableSubmit} className="space-y-4 animate-fade-in">
                <input
                  type="number"
                  placeholder="Enter table number"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  min="1"
                  max="100"
                  autoFocus
                  disabled={loading}
                />
                <button 
                  type="submit" 
                  className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all disabled:opacity-50 active:scale-95"
                  disabled={loading}
                >
                  {loading ? 'Verifying...' : 'Continue'}
                </button>
              </form>
            )}

            {/* Staff Access */}
            <div className="border-t pt-6 mt-6">
              <p className="text-center text-sm text-gray-500 mb-4 font-medium">Staff Access</p>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => navigate('/waiter')}
                  className="flex flex-col items-center p-3 rounded-xl bg-gray-50 hover:bg-gray-100 active:scale-95 transition-all"
                >
                  <Users className="w-6 h-6 text-gray-700 mb-2" />
                  <span className="text-xs font-medium text-gray-700">Waiter</span>
                </button>
                <button
                  onClick={() => navigate('/kot')}
                  className="flex flex-col items-center p-3 rounded-xl bg-gray-50 hover:bg-gray-100 active:scale-95 transition-all"
                >
                  <ChefHat className="w-6 h-6 text-gray-700 mb-2" />
                  <span className="text-xs font-medium text-gray-700">Kitchen</span>
                </button>
                <button
                  onClick={() => navigate('/admin')}
                  className="flex flex-col items-center p-3 rounded-xl bg-gray-50 hover:bg-gray-100 active:scale-95 transition-all"
                >
                  <Shield className="w-6 h-6 text-gray-700 mb-2" />
                  <span className="text-xs font-medium text-gray-700">Admin</span>
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-white text-sm opacity-75">
            © 2024 Restaurant. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Landing;