import React, { useState, useEffect, useRef } from 'react';
import { 
  DollarSign, Users, TrendingUp, Receipt, 
  RefreshCw, Printer, CreditCard, Clock, 
  Package, Calendar, Smartphone, Wallet, X
} from 'lucide-react';
import { adminAPI, billsAPI, tablesAPI } from '../services/api';
import toast from 'react-hot-toast';
import { useSocket } from '../context/SocketContext.jsx';
import { useRealTimeUpdates } from '../hooks/useRealTimeUpdates';
import BillPrint from '../components/BillPrint';

const API_BASE = 'http://localhost:5000/api';
const PUBLIC_URL = window.location.origin;

function Admin() {
  const { socket, globalOrders, globalTables, refreshData } = useSocket();
  const [stats, setStats] = useState({
    todayRevenue: 0,
    activeOrders: 0,
    occupiedTables: 0,
    totalTables: 20,
    todayOrders: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showBillModal, setShowBillModal] = useState(false);
  const [bill, setBill] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const billPrintRef = useRef();
  const [tables, setTables] = useState([]);

  useRealTimeUpdates({
    onOrdersUpdate: (orders) => {
      calculateStats(orders, globalTables);
    },
    onTablesUpdate: () => {
      calculateStats(globalOrders, globalTables);
      setTables(globalTables || []);
    },
    onNewOrder: (order) => {
      toast.success(`New order - Table ${order.table?.number}`, { duration: 2000 });
      refreshData();
    },
    onOrderUpdated: () => {
      refreshData();
    },
    onBillUpdated: () => {
      if (showBillModal) {
        setShowBillModal(false);
      }
      refreshData();
    },
    onRefresh: () => {
      refreshData();
      fetchDashboard();
    }
  });

  useEffect(() => {
    fetchDashboard();
    // Load tables for QR section
    (async () => {
      try {
        const res = await tablesAPI.getAll();
        setTables(res.data.data || []);
      } catch {}
    })();
    setLoading(false);
  }, []);

  useEffect(() => {
    calculateStats(globalOrders, globalTables);
    if (globalTables && globalTables.length) setTables(globalTables);
  }, [globalOrders, globalTables]);

  const calculateStats = (orders, tables) => {
    orders = orders || [];
    tables = tables || [];
    const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
    const occupiedTables = tables.filter(t => t.status === 'occupied').length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayOrders = orders.filter(o => new Date(o.createdAt) >= today);
    const todayRevenue = todayOrders
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
    setStats({
      todayRevenue,
      activeOrders: activeOrders.length,
      occupiedTables,
      totalTables: tables.length,
      todayOrders: todayOrders.length
    });
  };

  const fetchDashboard = async () => {
    try {
      const response = await adminAPI.getDashboard();
      setStats(prev => ({ ...prev, ...response.data.data }));
    } catch (error) {
      console.error('Failed to load dashboard');
    }
  };

  const generateAndShowBill = async (order) => {
    try {
      const response = await billsAPI.generate(order.id);
      setBill(response.data.data);
      setSelectedOrder(order);
      setShowBillModal(true);
    } catch (error) {
      toast.error('Failed to generate bill');
    }
  };

  const handlePrintBill = () => {
    const printContent = document.getElementById('bill-print-content');
    if (!printContent) return;

    const printWindow = window.open('', 'PRINT', 'height=600,width=800');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bill Receipt</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { margin: 0; padding: 0; font-family: 'Courier New', monospace; }
            @media print { body { margin: 0; padding: 0; } }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      setTimeout(() => printWindow.close(), 100);
    }, 250);
  };

  const settleBill = async (paymentMethod) => {
    if (!bill) return;

    setProcessingPayment(true);
    try {
      const totalAmount = parseFloat(bill.totalAmount);
      await billsAPI.settle(bill.id, { paymentMethod, paidAmount: totalAmount });
      setBill(prev => ({ ...prev, paymentMethod, paidAmount: totalAmount }));
      toast.success(`Payment received`, { duration: 2000 });
      setTimeout(() => { handlePrintBill(); }, 500);
    } catch (error) {
      toast.error('Payment failed');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleCloseBillModal = () => {
    setShowBillModal(false);
    setBill(null);
    setSelectedOrder(null);
    refreshData();
  };

  const activeOrders = globalOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const qrImgUrl = (tableNumber, size = 220) =>
    `${API_BASE}/tables/${encodeURIComponent(tableNumber)}/qr?size=${size}`;
  const tableCustomerLink = (tableNumber) =>
    `${PUBLIC_URL}/menu/${encodeURIComponent(tableNumber)}?src=qr`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Admin</h1>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>{new Date().toLocaleDateString()}</span>
              </div>
              <button 
                onClick={refreshData}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RefreshCw className="w-5 h-5 text-gray-700" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl p-4 sm:p-6 border-l-4 border-green-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Revenue</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">₹{stats.todayRevenue.toFixed(0)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 sm:p-6 border-l-4 border-blue-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Active</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.activeOrders}</p>
          </div>
          <div className="bg-white rounded-xl p-4 sm:p-6 border-l-4 border-purple-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Tables</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">
              {stats.occupiedTables}/{stats.totalTables}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 sm:p-6 border-l-4 border-orange-500">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Orders</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.todayOrders}</p>
          </div>
        </div>

        {/* Orders Section */}
        <div className="bg-white rounded-xl overflow-hidden mb-8">
          <div className="px-4 sm:px-6 py-4 border-b">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              All Orders ({globalOrders.length})
            </h2>
          </div>

          {/* Mobile Cards */}
          <div className="block lg:hidden">
            {globalOrders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No orders</div>
            ) : (
              <div className="divide-y">
                {globalOrders.map(order => (
                  <div key={order.id} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-gray-900">#{order.orderNumber}</p>
                        <p className="text-sm text-gray-600">Table {order.table?.number}</p>
                      </div>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                        order.status === 'completed' ? 'bg-green-100 text-green-700' :
                        order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-600">{order.items?.length || 0} items</p>
                        <p className="text-lg font-bold text-gray-900">₹{parseFloat(order.total || 0).toFixed(2)}</p>
                      </div>
                      {order.status !== 'completed' && order.status !== 'cancelled' && (
                        <button
                          onClick={() => generateAndShowBill(order)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                        >
                          Bill
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Table</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {globalOrders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">#{order.orderNumber}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{order.table?.number}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{order.items?.length || 0}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">₹{parseFloat(order.total || 0).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                        order.status === 'completed' ? 'bg-green-100 text-green-700' :
                        order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(order.createdAt).toLocaleTimeString()}</td>
                    <td className="px-6 py-4">
                      {order.status !== 'completed' && order.status !== 'cancelled' ? (
                        <button
                          onClick={() => generateAndShowBill(order)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                        >
                          Generate Bill
                        </button>
                      ) : (
                        <span className="text-sm text-gray-400">{order.status === 'completed' ? 'Paid' : 'Cancelled'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {globalOrders.length === 0 && (
              <div className="text-center py-12 text-gray-500">No orders yet</div>
            )}
          </div>
        </div>

        {/* QR Codes Section */}
        <div className="bg-white rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900">QR Codes by Table</h3>
            <a
              href={`${API_BASE}/tables/qr/print?size=260`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print All
            </a>
          </div>

          {tables.length === 0 ? (
            <div className="text-center text-gray-500 py-12">No tables found</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {tables.map((t) => (
                <div key={t.id} className="border rounded-xl p-4">
                  <div className="text-sm text-gray-600 mb-2 font-medium">Table {t.number}</div>
                  <div className="bg-white rounded-lg p-3 border flex items-center justify-center">
                    <img
                      src={qrImgUrl(t.number, 220)}
                      alt={`Table ${t.number} QR`}
                      className="w-[220px] h-[220px]"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-3 text-xs text-gray-600 break-words">{tableCustomerLink(t.number)}</div>
                  <div className="flex items-center gap-2 mt-3">
                    <a
                      href={`${API_BASE}/tables/${t.number}/qr?size=600&download=1`}
                      className="flex-1 px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm text-center"
                    >
                      Download
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(tableCustomerLink(t.number));
                        toast.success('Link copied');
                      }}
                      className="flex-1 px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
                    >
                      Copy Link
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Bill Modal */}
      {showBillModal && bill && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg sm:text-xl font-bold">Bill - Table {selectedOrder?.table?.number}</h2>
              <button 
                onClick={handleCloseBillModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-gray-50 overflow-y-auto max-h-[50vh]">
              <div className="bg-white rounded-lg">
                <BillPrint ref={billPrintRef} bill={bill} order={selectedOrder} />
              </div>
            </div>

            <div className="p-4 border-t bg-white space-y-3">
              <button
                onClick={handlePrintBill}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium"
              >
                <Printer className="w-5 h-5" />
                Print Bill
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => settleBill('cash')}
                  disabled={processingPayment}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                >
                  Cash
                </button>
                <button 
                  onClick={() => settleBill('card')}
                  disabled={processingPayment}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50"
                >
                  Card
                </button>
                <button 
                  onClick={() => settleBill('upi')}
                  disabled={processingPayment}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium disabled:opacity-50"
                >
                  UPI
                </button>
                <button 
                  onClick={() => settleBill('wallet')}
                  disabled={processingPayment}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50"
                >
                  Wallet
                </button>
              </div>
              {processingPayment && (
                <div className="text-center text-sm text-gray-600">Processing payment...</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;