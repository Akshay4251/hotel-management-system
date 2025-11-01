import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Hash, Users, ChefHat, Shield, Utensils, X, Camera } from 'lucide-react';
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
          showZoomSliderIfSupported: true,
          defaultZoomValueIfSupported: 2,
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

  const onScanSuccess = async (decodedText, decodedResult) => {
    console.log('✅ QR Scan success:', decodedText);
    
    try {
      // Extract table number from URL
      // Expected format: https://yourdomain.com/menu/5?src=qr
      const url = new URL(decodedText);
      const pathParts = url.pathname.split('/');
      const tableNumberFromQR = pathParts[pathParts.length - 1];

      if (tableNumberFromQR) {
        setShowScanner(false);
        toast.success(`Table ${tableNumberFromQR} detected!`);
        
        // Verify table exists
        setLoading(true);
        const response = await tablesAPI.verify(tableNumberFromQR);
        
        if (response.data.success) {
          navigate(`/menu/${tableNumberFromQR}`);
        }
      } else {
        toast.error('Invalid QR code format');
      }
    } catch (error) {
      console.error('QR parsing error:', error);
      toast.error('Invalid QR code. Please scan a table QR code.');
    } finally {
      setLoading(false);
    }
  };

  const onScanError = (errorMessage) => {
    // Ignore continuous scan errors (camera is just searching)
    // Only log actual errors
    if (!errorMessage.includes('No MultiFormat Readers')) {
      console.warn('QR Scan error:', errorMessage);
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-600">
      {/* Main Content */}
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
                className="p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all border-2 border-transparent hover:border-red-200"
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
                className={`p-6 rounded-xl transition-all border-2 ${
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
                  className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all disabled:opacity-50"
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
                  className="flex flex-col items-center p-3 rounded-xl bg-gray-50 hover:bg-gray-100"
                >
                  <Users className="w-6 h-6 text-gray-700 mb-2" />
                  <span className="text-xs font-medium text-gray-700">Waiter</span>
                </button>
                <button
                  onClick={() => navigate('/kot')}
                  className="flex flex-col items-center p-3 rounded-xl bg-gray-50 hover:bg-gray-100"
                >
                  <ChefHat className="w-6 h-6 text-gray-700 mb-2" />
                  <span className="text-xs font-medium text-gray-700">Kitchen</span>
                </button>
                <button
                  onClick={() => navigate('/admin')}
                  className="flex flex-col items-center p-3 rounded-xl bg-gray-50 hover:bg-gray-100"
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

      {/* QR Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-bold text-gray-900">Scan Table QR Code</h3>
              </div>
              <button
                onClick={handleCloseScanner}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Scanner */}
            <div className="p-4">
              <div 
                id="qr-reader" 
                className="w-full rounded-xl overflow-hidden"
              ></div>
              
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800 text-center">
                  📱 Point your camera at the QR code on your table
                </p>
              </div>

              {loading && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-gray-600">Verifying table...</span>
                </div>
              )}
            </div>

            {/* Manual Entry Link */}
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowScanner(false);
                  setShowInput(true);
                }}
                className="w-full text-sm text-gray-600 hover:text-red-600 transition-colors"
              >
                Can't scan? Enter table number manually →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Landing;