import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Hash, Users, ChefHat, Shield, Utensils } from 'lucide-react';
import { tablesAPI } from '../services/api';
import toast from 'react-hot-toast';

function Landing() {
  const [tableNumber, setTableNumber] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
                onClick={() => toast.info('Scan QR code on your table')}
              >
                <div className="flex flex-col items-center space-y-3">
                  <div className="p-3 bg-white rounded-full shadow-md">
                    <QrCode className="w-8 h-8 text-red-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Scan QR</span>
                </div>
              </button>

              <button 
                onClick={() => setShowInput(!showInput)}
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
                  max="20"
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
    </div>
  );
}

export default Landing;