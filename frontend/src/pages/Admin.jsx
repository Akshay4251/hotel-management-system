import React, { useState, useEffect, useRef } from 'react';
import { 
  DollarSign, Users, TrendingUp, Receipt, 
  RefreshCw, Printer, CreditCard, Clock, 
  Package, Calendar, Smartphone, Wallet, X,
  Plus, Edit, Trash2, Save, Search, Filter,
  ChevronDown, QrCode, UtensilsCrossed, TableProperties,
  Upload, Image as ImageIcon
} from 'lucide-react';
import { adminAPI, billsAPI, tablesAPI, menuAPI } from '../services/api';
import toast from 'react-hot-toast';
import { useSocket } from '../context/SocketContext.jsx';
import { useRealTimeUpdates } from '../hooks/useRealTimeUpdates';
import BillPrint from '../components/BillPrint';

const API_BASE_URL = import.meta.env.DEV 
  ? 'http://localhost:5000' 
  : '';
const PUBLIC_URL = window.location.origin;

function Admin() {
  const { socket, globalOrders, globalTables, refreshData } = useSocket();
  
  // State Management
  const [activeTab, setActiveTab] = useState('dashboard');
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
  
  // Tables Management
  const [tables, setTables] = useState([]);
  const [showTableModal, setShowTableModal] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [tableForm, setTableForm] = useState({ number: '', capacity: 4 });
  
  // Menu Management
  const [menuItems, setMenuItems] = useState([]);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [menuForm, setMenuForm] = useState({
    name: '',
    category: '',
    price: '',
    description: '',
    isAvailable: true,
    image: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categories, setCategories] = useState([]);
  
  // Image Upload States
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  // Real-time Updates
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

  // Initial Load
  useEffect(() => {
    fetchDashboard();
    loadTables();
    loadMenu();
    setLoading(false);
  }, []);

  useEffect(() => {
    calculateStats(globalOrders, globalTables);
    if (globalTables && globalTables.length) setTables(globalTables);
  }, [globalOrders, globalTables]);

  // ===================
  // API Functions
  // ===================

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

  const loadTables = async () => {
    try {
      const res = await tablesAPI.getAll();
      setTables(res.data.data || []);
    } catch (error) {
      toast.error('Failed to load tables');
    }
  };

  const loadMenu = async () => {
    try {
      const res = await menuAPI.getAll();
      setMenuItems(res.data.data || []);
      
      // Extract unique categories
      const uniqueCategories = [...new Set(res.data.data.map(item => item.category))];
      setCategories(uniqueCategories);
    } catch (error) {
      toast.error('Failed to load menu');
    }
  };

  // ===================
  // Table CRUD
  // ===================

  const handleAddTable = () => {
    setEditingTable(null);
    setTableForm({ number: '', capacity: 4 });
    setShowTableModal(true);
  };

  const handleEditTable = (table) => {
    setEditingTable(table);
    setTableForm({ number: table.number, capacity: table.capacity });
    setShowTableModal(true);
  };

  const handleSaveTable = async () => {
    if (!tableForm.number) {
      toast.error('Table number is required');
      return;
    }

    try {
      if (editingTable) {
        await tablesAPI.update(editingTable.id, tableForm);
        toast.success('Table updated successfully');
      } else {
        await tablesAPI.create(tableForm);
        toast.success('Table created successfully');
      }
      
      setShowTableModal(false);
      loadTables();
      refreshData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save table');
    }
  };

  const handleDeleteTable = async (table) => {
    if (!window.confirm(`Delete Table ${table.number}?`)) return;

    try {
      await tablesAPI.delete(table.id);
      toast.success('Table deleted');
      loadTables();
      refreshData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete table');
    }
  };

  // ===================
  // Image Upload Functions
  // ===================

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    setSelectedImage(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const uploadImage = async () => {
    if (!selectedImage) return null;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('image', selectedImage);

    try {
      const response = await menuAPI.uploadImage(formData);
      return response.data.imageUrl;
    } catch (error) {
      console.error('Image upload failed:', error);
      toast.error('Failed to upload image');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ===================
  // Menu CRUD
  // ===================

  const handleAddMenuItem = () => {
    setEditingMenuItem(null);
    setMenuForm({
      name: '',
      category: '',
      price: '',
      description: '',
      isAvailable: true,
      image: ''
    });
    setSelectedImage(null);
    setImagePreview(null);
    setShowMenuModal(true);
  };

  const handleEditMenuItem = (item) => {
    setEditingMenuItem(item);
    setMenuForm({
      name: item.name,
      category: item.category,
      price: item.price,
      description: item.description || '',
      isAvailable: item.isAvailable,
      image: item.image || ''
    });
    setSelectedImage(null);
    setImagePreview(item.image ? `${API_BASE_URL}${item.image}` : null);
    setShowMenuModal(true);
  };

  const handleSaveMenuItem = async () => {
    if (!menuForm.name || !menuForm.category || !menuForm.price) {
      toast.error('Name, category, and price are required');
      return;
    }

    try {
      let imageUrl = menuForm.image;

      // Upload new image if selected
      if (selectedImage) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      const menuData = {
        ...menuForm,
        image: imageUrl || null
      };

      if (editingMenuItem) {
        await menuAPI.update(editingMenuItem.id, menuData);
        toast.success('Menu item updated');
      } else {
        await menuAPI.create(menuData);
        toast.success('Menu item created');
      }
      
      setShowMenuModal(false);
      setSelectedImage(null);
      setImagePreview(null);
      loadMenu();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save menu item');
    }
  };

  const handleDeleteMenuItem = async (item) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;

    try {
      await menuAPI.delete(item.id);
      toast.success('Menu item deleted');
      loadMenu();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete menu item');
    }
  };

  const toggleMenuAvailability = async (item) => {
    try {
      await menuAPI.updateAvailability(item.id, !item.isAvailable);
      toast.success(`${item.name} ${item.isAvailable ? 'disabled' : 'enabled'}`);
      loadMenu();
    } catch (error) {
      toast.error('Failed to update availability');
    }
  };

  // ===================
  // Billing
  // ===================

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
      toast.success(`Payment received via ${paymentMethod}`);
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

  // ===================
  // Filters
  // ===================

  const filteredMenuItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const qrImgUrl = (tableNumber, size = 220) =>
    `${API_BASE_URL}/api/tables/${encodeURIComponent(tableNumber)}/qr?size=${size}`;
  const tableCustomerLink = (tableNumber) =>
    `${PUBLIC_URL}/menu/${encodeURIComponent(tableNumber)}?src=qr`;

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Admin Panel</h1>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>{new Date().toLocaleDateString()}</span>
              </div>
              <button 
                onClick={refreshData}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh Data"
              >
                <RefreshCw className="w-5 h-5 text-gray-700" />
              </button>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto hide-scrollbar -mb-px">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
              { id: 'orders', label: 'Orders', icon: Receipt },
              { id: 'tables', label: 'Tables', icon: TableProperties },
              { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
              { id: 'qr', label: 'QR Codes', icon: QrCode }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-8 h-8 opacity-80" />
                </div>
                <p className="text-sm opacity-90 mb-1">Today's Revenue</p>
                <p className="text-3xl font-bold">₹{stats.todayRevenue.toFixed(0)}</p>
              </div>
              
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <Receipt className="w-8 h-8 opacity-80" />
                </div>
                <p className="text-sm opacity-90 mb-1">Active Orders</p>
                <p className="text-3xl font-bold">{stats.activeOrders}</p>
              </div>
              
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-8 h-8 opacity-80" />
                </div>
                <p className="text-sm opacity-90 mb-1">Occupied Tables</p>
                <p className="text-3xl font-bold">{stats.occupiedTables}/{stats.totalTables}</p>
              </div>
              
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <Package className="w-8 h-8 opacity-80" />
                </div>
                <p className="text-sm opacity-90 mb-1">Today's Orders</p>
                <p className="text-3xl font-bold">{stats.todayOrders}</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <button
                  onClick={() => setActiveTab('tables')}
                  className="p-4 border-2 border-gray-200 rounded-xl hover:border-red-600 hover:bg-red-50 transition-all group"
                >
                  <TableProperties className="w-8 h-8 text-gray-600 group-hover:text-red-600 mb-2 mx-auto" />
                  <p className="text-sm font-medium text-gray-900">Manage Tables</p>
                </button>
                
                <button
                  onClick={() => setActiveTab('menu')}
                  className="p-4 border-2 border-gray-200 rounded-xl hover:border-red-600 hover:bg-red-50 transition-all group"
                >
                  <UtensilsCrossed className="w-8 h-8 text-gray-600 group-hover:text-red-600 mb-2 mx-auto" />
                  <p className="text-sm font-medium text-gray-900">Manage Menu</p>
                </button>
                
                <button
                  onClick={() => setActiveTab('orders')}
                  className="p-4 border-2 border-gray-200 rounded-xl hover:border-red-600 hover:bg-red-50 transition-all group"
                >
                  <Receipt className="w-8 h-8 text-gray-600 group-hover:text-red-600 mb-2 mx-auto" />
                  <p className="text-sm font-medium text-gray-900">View Orders</p>
                </button>
                
                <button
                  onClick={() => setActiveTab('qr')}
                  className="p-4 border-2 border-gray-200 rounded-xl hover:border-red-600 hover:bg-red-50 transition-all group"
                >
                  <QrCode className="w-8 h-8 text-gray-600 group-hover:text-red-600 mb-2 mx-auto" />
                  <p className="text-sm font-medium text-gray-900">QR Codes</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                All Orders ({globalOrders.length})
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {stats.activeOrders} active
                </span>
              </div>
            </div>

            {/* Mobile Cards */}
            <div className="block lg:hidden">
              {globalOrders.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <Receipt className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>No orders yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {globalOrders.map(order => (
                    <div key={order.id} className="p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-bold text-gray-900">#{order.orderNumber}</p>
                          <p className="text-sm text-gray-600">Table {order.table?.number}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(order.createdAt).toLocaleTimeString()}
                          </p>
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
                            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                          >
                            Generate Bill
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Table</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {globalOrders.map(order => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">#{order.orderNumber}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">Table {order.table?.number}</td>
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
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(order.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="px-6 py-4">
                        {order.status !== 'completed' && order.status !== 'cancelled' ? (
                          <button
                            onClick={() => generateAndShowBill(order)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                          >
                            Generate Bill
                          </button>
                        ) : (
                          <span className="text-sm text-gray-400">
                            {order.status === 'completed' ? 'Paid' : 'Cancelled'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {globalOrders.length === 0 && (
                <div className="text-center py-16 text-gray-500">
                  <Receipt className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>No orders yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tables Management Tab */}
        {activeTab === 'tables' && (
          <div className="bg-white rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Tables Management ({tables.length})</h2>
              <button
                onClick={handleAddTable}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Add Table</span>
              </button>
            </div>

            <div className="p-6">
              {tables.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <TableProperties className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>No tables yet. Click "Add Table" to create one.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {tables.map(table => (
                    <div key={table.id} className="border-2 rounded-xl p-4 hover:border-red-600 transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">Table {table.number}</h3>
                          <p className="text-sm text-gray-600">{table.capacity} seats</p>
                        </div>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          table.status === 'occupied' ? 'bg-red-100 text-red-700' :
                          table.status === 'reserved' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {table.status}
                        </span>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditTable(table)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTable(table)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Menu Management Tab */}
        {activeTab === 'menu' && (
          <div className="bg-white rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-xl font-bold text-gray-900">Menu Management ({menuItems.length})</h2>
                <button
                  onClick={handleAddMenuItem}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span>Add Menu Item</span>
                </button>
              </div>
              
              {/* Search and Filter */}
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search menu items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                >
                  <option value="all">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6">
              {filteredMenuItems.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <UtensilsCrossed className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>{menuItems.length === 0 ? 'No menu items yet' : 'No items match your search'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMenuItems.map(item => (
                    <div key={item.id} className="border rounded-xl overflow-hidden hover:shadow-lg transition-all">
                      {/* Image Section */}
                      {item.image ? (
                        <div className="h-48 bg-gray-100 overflow-hidden">
                          <img
                            src={`${API_BASE_URL}${item.image}`}
                            alt={item.name}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f3f4f6" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-family="sans-serif" font-size="16"%3ENo Image%3C/text%3E%3C/svg%3E';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                          <ImageIcon className="w-16 h-16 text-gray-400" />
                        </div>
                      )}
                      
                      {/* Content Section */}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-bold text-gray-900 mb-1">{item.name}</h3>
                            <p className="text-sm text-gray-600 mb-2">{item.category}</p>
                            <p className="text-lg font-bold text-red-600">₹{parseFloat(item.price).toFixed(2)}</p>
                          </div>
                          <button
                            onClick={() => toggleMenuAvailability(item)}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                              item.isAvailable
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                          >
                            {item.isAvailable ? 'Available' : 'Unavailable'}
                          </button>
                        </div>
                        
                        {item.description && (
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>
                        )}
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditMenuItem(item)}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteMenuItem(item)}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* QR Codes Tab */}
        {activeTab === 'qr' && (
          <div className="bg-white rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">QR Codes by Table</h3>
              <a
                href={`${API_BASE_URL}/api/tables/qr/print?size=260`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print All QR Codes
              </a>
            </div>

            {tables.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <QrCode className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>No tables found. Add tables first to generate QR codes.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {tables.map((t) => (
                  <div key={t.id} className="border-2 rounded-xl p-4 hover:border-red-600 transition-all">
                    <div className="text-center">
                      <p className="text-sm font-bold text-gray-900 mb-3">Table {t.number}</p>
                      <div className="bg-white rounded-lg p-3 border-2 inline-block">
                        <img
                          src={qrImgUrl(t.number, 220)}
                          alt={`Table ${t.number} QR`}
                          className="w-[180px] h-[180px]"
                          loading="lazy"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-3 break-all">
                        {tableCustomerLink(t.number)}
                      </p>
                      <div className="flex flex-col gap-2 mt-4">
                        <a
                          href={`${API_BASE_URL}/api/tables/${t.number}/qr?size=600&download=1`}
                          download
                          className="w-full px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm font-medium text-center transition-colors"
                        >
                          Download QR
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(tableCustomerLink(t.number));
                            toast.success('Link copied to clipboard!');
                          }}
                          className="w-full px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
                        >
                          Copy Customer Link
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Table Modal */}
      {showTableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold">
                {editingTable ? 'Edit Table' : 'Add New Table'}
              </h2>
              <button 
                onClick={() => setShowTableModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Table Number *
                </label>
                <input
                  type="number"
                  value={tableForm.number}
                  onChange={(e) => setTableForm({ ...tableForm, number: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                  placeholder="Enter table number"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capacity (Seats) *
                </label>
                <input
                  type="number"
                  value={tableForm.capacity}
                  onChange={(e) => setTableForm({ ...tableForm, capacity: parseInt(e.target.value) || 4 })}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                  placeholder="Number of seats"
                  min="1"
                  max="20"
                />
              </div>
            </div>

            <div className="p-6 border-t flex gap-3">
              <button
                onClick={() => setShowTableModal(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTable}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Save className="w-5 h-5" />
                {editingTable ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu Item Modal */}
      {showMenuModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold">
                {editingMenuItem ? 'Edit Menu Item' : 'Add New Menu Item'}
              </h2>
              <button 
                onClick={() => setShowMenuModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Image Upload Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Image
                </label>
                <div className="space-y-3">
                  {/* Preview */}
                  {imagePreview ? (
                    <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={removeImage}
                        className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-full h-64 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-red-600 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-12 h-12 text-gray-400 mb-3" />
                      <p className="text-sm text-gray-600 mb-1">Click to upload image</p>
                      <p className="text-xs text-gray-500">PNG, JPG, WEBP up to 5MB</p>
                    </div>
                  )}
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  
                  {!imagePreview && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-gray-300 rounded-lg hover:border-red-600 hover:bg-red-50 transition-colors"
                    >
                      <ImageIcon className="w-5 h-5" />
                      <span>Choose Image</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    value={menuForm.name}
                    onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                    placeholder="e.g., Chicken Burger"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <input
                    type="text"
                    value={menuForm.category}
                    onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                    placeholder="e.g., Main Course"
                    list="categories"
                  />
                  <datalist id="categories">
                    {categories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    value={menuForm.price}
                    onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={menuForm.description}
                    onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 resize-none"
                    rows="3"
                    placeholder="Brief description of the item"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isAvailable"
                    checked={menuForm.isAvailable}
                    onChange={(e) => setMenuForm({ ...menuForm, isAvailable: e.target.checked })}
                    className="w-5 h-5 text-red-600 rounded focus:ring-2 focus:ring-red-600"
                  />
                  <label htmlFor="isAvailable" className="text-sm font-medium text-gray-700">
                    Available for ordering
                  </label>
                </div>
              </div>
            </div>

            <div className="p-6 border-t flex gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowMenuModal(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMenuItem}
                disabled={uploadingImage}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingImage ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    <span>{editingMenuItem ? 'Update Item' : 'Create Item'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium transition-colors"
              >
                <Printer className="w-5 h-5" />
                Print Bill
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => settleBill('cash')}
                  disabled={processingPayment}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Wallet className="w-5 h-5" />
                  Cash
                </button>
                <button 
                  onClick={() => settleBill('card')}
                  disabled={processingPayment}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <CreditCard className="w-5 h-5" />
                  Card
                </button>
                <button 
                  onClick={() => settleBill('upi')}
                  disabled={processingPayment}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Smartphone className="w-5 h-5" />
                  UPI
                </button>
                <button 
                  onClick={() => settleBill('wallet')}
                  disabled={processingPayment}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Wallet className="w-5 h-5" />
                  Wallet
                </button>
              </div>
              {processingPayment && (
                <div className="text-center text-sm text-gray-600 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                  Processing payment...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;