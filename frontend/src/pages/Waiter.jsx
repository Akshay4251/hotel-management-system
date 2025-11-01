import React, { useState, useEffect } from 'react';
import { User, Plus, RefreshCw, Clock, X, Minus, Check, Users as UsersIcon, Home } from 'lucide-react';
import { tablesAPI, ordersAPI, menuAPI } from '../services/api';
import toast from 'react-hot-toast';
import { useSocket } from '../context/SocketContext';

function Waiter() {
  const { socket } = useSocket();
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    fetchData();

    if (socket) {
      socket.on('new-order', () => {
        fetchOrders();
      });

      socket.on('table-updated', () => {
        fetchTables();
      });
    }

    return () => {
      if (socket) {
        socket.off('new-order');
        socket.off('table-updated');
      }
    };
  }, [socket]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchTables(), fetchOrders(), fetchMenu()]);
    setLoading(false);
  };

  const fetchTables = async () => {
    try {
      const response = await tablesAPI.getAll();
      setTables(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load tables');
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await ordersAPI.getAll();
      setOrders(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load orders');
    }
  };

  const fetchMenu = async () => {
    try {
      const response = await menuAPI.getAll();
      setMenuItems(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load menu');
    }
  };

  const handleTableClick = (table) => {
    setSelectedTable(table);
    setCart([]);
    setShowOrderModal(true);
  };

  const addToCart = (item) => {
    const existing = cart.find(i => i.id === item.id);
    if (existing) {
      setCart(cart.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
    toast.success(`${item.name} added`, { duration: 1000 });
  };

  const removeFromCart = (itemId) => {
    const existing = cart.find(i => i.id === itemId);
    if (existing && existing.quantity > 1) {
      setCart(cart.map(i => i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i));
    } else {
      setCart(cart.filter(i => i.id !== itemId));
    }
  };

  const placeOrder = async () => {
    if (!selectedTable || cart.length === 0) return;

    try {
      await ordersAPI.create({
        tableNumber: selectedTable.number,
        items: cart.map(item => ({ menuItemId: item.id, quantity: item.quantity })),
        type: 'dine-in',
      });
      toast.success('Order placed successfully!');
      setShowOrderModal(false);
      setCart([]);
      fetchData();
    } catch (error) {
      toast.error('Failed to place order');
    }
  };

  const categories = ['All', ...new Set(menuItems.map(item => item.category))];
  const filteredMenu = activeCategory === 'All' 
    ? menuItems.filter(item => item.isAvailable)
    : menuItems.filter(item => item.category === activeCategory && item.isAvailable);

  const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');

  const getStatusBadge = (status) => {
    const badges = {
      'available': { bg: 'bg-green-100', text: 'text-green-700', label: 'Free' },
      'occupied': { bg: 'bg-red-100', text: 'text-red-700', label: 'Busy' },
      'reserved': { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Res' },
    };
    return badges[status] || badges['available'];
  };

  const getOrderStatusBadge = (status) => {
    const badges = {
      'pending': { bg: 'bg-orange-100', text: 'text-orange-700', icon: '⏳' },
      'preparing': { bg: 'bg-blue-100', text: 'text-blue-700', icon: '👨‍🍳' },
      'ready': { bg: 'bg-green-100', text: 'text-green-700', icon: '✅' },
    };
    return badges[status] || badges['pending'];
  };

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
      <header className="bg-white border-b sticky top-0 z-40 shadow-sm">
        <div className="px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <User className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Waiter Panel</h1>
                <p className="text-xs text-gray-600 hidden sm:block">Manage tables & orders</p>
              </div>
            </div>
            <button 
              onClick={fetchData} 
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Stats Cards - Mobile Optimized */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-white rounded-xl p-3 sm:p-4 border shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Home className="w-4 h-4 text-gray-600" />
              <p className="text-xs text-gray-600">Total Tables</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{tables.length}</p>
          </div>
          
          <div className="bg-white rounded-xl p-3 sm:p-4 border shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <p className="text-xs text-gray-600">Available</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-green-600">
              {tables.filter(t => t.status === 'available').length}
            </p>
          </div>
          
          <div className="bg-white rounded-xl p-3 sm:p-4 border shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <p className="text-xs text-gray-600">Occupied</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-red-600">
              {tables.filter(t => t.status === 'occupied').length}
            </p>
          </div>
          
          <div className="bg-white rounded-xl p-3 sm:p-4 border shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-gray-600" />
              <p className="text-xs text-gray-600">Active Orders</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-orange-600">{activeOrders.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Tables Grid */}
          <div className="bg-white rounded-xl p-3 sm:p-4 lg:p-6 border shadow-sm">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">Tables</h2>
              <span className="text-xs sm:text-sm text-gray-600">{tables.length} total</span>
            </div>
            
            {/* Responsive Grid: 4 cols mobile, 5 cols tablet, 6 cols desktop */}
            <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 sm:gap-3">
              {tables.map(table => {
                const statusBadge = getStatusBadge(table.status);
                return (
                  <button
                    key={table.id}
                    onClick={() => handleTableClick(table)}
                    className={`aspect-square rounded-xl border-2 transition-all hover:scale-105 active:scale-95 ${
                      table.status === 'available' 
                        ? 'bg-green-50 border-green-500 hover:bg-green-100' 
                        : 'bg-red-50 border-red-500 hover:bg-red-100'
                    }`}
                  >
                    <div className="h-full flex flex-col items-center justify-center p-1 sm:p-2">
                      <p className="font-bold text-base sm:text-lg lg:text-xl text-gray-900">{table.number}</p>
                      <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full mt-1 ${statusBadge.bg} ${statusBadge.text} font-medium`}>
                        {statusBadge.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {tables.length === 0 && (
              <div className="text-center py-12">
                <Home className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No tables available</p>
              </div>
            )}
          </div>

          {/* Active Orders */}
          <div className="bg-white rounded-xl p-3 sm:p-4 lg:p-6 border shadow-sm">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">Active Orders</h2>
              <span className="text-xs sm:text-sm px-2 py-1 bg-orange-100 text-orange-700 rounded-full font-medium">
                {activeOrders.length}
              </span>
            </div>
            
            <div className="space-y-2 sm:space-y-3 max-h-[400px] sm:max-h-[500px] overflow-y-auto custom-scrollbar">
              {activeOrders.map(order => {
                const statusBadge = getOrderStatusBadge(order.status);
                return (
                  <div key={order.id} className="p-3 sm:p-4 bg-gray-50 rounded-lg border hover:border-red-200 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-600 text-white rounded-lg flex items-center justify-center font-bold text-sm sm:text-base">
                          {order.table?.number}
                        </div>
                        <div>
                          <p className="font-bold text-sm sm:text-base text-gray-900">
                            Table {order.table?.number}
                          </p>
                          <p className="text-xs text-gray-600">#{order.orderNumber}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded-full font-medium ${statusBadge.bg} ${statusBadge.text} flex items-center gap-1`}>
                        <span>{statusBadge.icon}</span>
                        <span className="capitalize">{order.status}</span>
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center mt-2 pt-2 border-t">
                      <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-600">
                        <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="font-bold text-sm sm:text-base text-gray-900">₹{parseFloat(order.total).toFixed(2)}</p>
                    </div>

                    {/* Items count */}
                    <div className="mt-2 text-xs text-gray-600">
                      {order.items?.length || 0} item(s)
                    </div>
                  </div>
                );
              })}
              
              {activeOrders.length === 0 && (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No active orders</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Order Modal - Fully Responsive */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-3 sm:p-4 border-b flex justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">New Order</h2>
                <p className="text-xs sm:text-sm text-gray-600">Table {selectedTable?.number}</p>
              </div>
              <button 
                onClick={() => setShowOrderModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            {/* Categories - Horizontal Scroll */}
            <div className="px-3 sm:px-4 py-2 sm:py-3 border-b overflow-x-auto hide-scrollbar bg-gray-50">
              <div className="flex gap-2">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg whitespace-nowrap text-xs sm:text-sm font-medium transition-all ${
                      activeCategory === cat
                        ? 'bg-red-600 text-white shadow-md'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Items - Scrollable */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                {filteredMenu.map(item => {
                  const cartItem = cart.find(i => i.id === item.id);
                  return (
                    <div key={item.id} className="p-3 sm:p-4 bg-gray-50 rounded-lg border hover:border-red-200 transition-all">
                      <div className="flex justify-between items-start gap-2 sm:gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate">{item.name}</h3>
                          <p className="text-xs sm:text-sm text-gray-600 mt-0.5">{item.category}</p>
                          <p className="text-sm sm:text-base font-bold text-red-600 mt-1">₹{parseFloat(item.price).toFixed(2)}</p>
                        </div>
                        
                        {cartItem ? (
                          <div className="flex items-center gap-1 sm:gap-2 bg-red-600 text-white rounded-lg shadow-md">
                            <button 
                              onClick={() => removeFromCart(item.id)} 
                              className="p-1.5 sm:p-2 hover:bg-red-700 rounded-lg transition-colors active:scale-95"
                            >
                              <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                            <span className="w-6 sm:w-8 text-center font-bold text-sm sm:text-base">{cartItem.quantity}</span>
                            <button 
                              onClick={() => addToCart(item)} 
                              className="p-1.5 sm:p-2 hover:bg-red-700 rounded-lg transition-colors active:scale-95"
                            >
                              <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => addToCart(item)}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-xs sm:text-sm transition-colors active:scale-95 whitespace-nowrap"
                          >
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredMenu.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-sm">No items in this category</p>
                </div>
              )}
            </div>

            {/* Footer - Cart Summary */}
            <div className="p-3 sm:p-4 border-t bg-white sticky bottom-0 shadow-lg">
              {cart.length > 0 && (
                <div className="mb-3 max-h-32 overflow-y-auto custom-scrollbar">
                  <p className="text-xs font-medium text-gray-600 mb-2">Cart Items:</p>
                  <div className="space-y-1">
                    {cart.map(item => (
                      <div key={item.id} className="flex justify-between text-xs text-gray-700">
                        <span className="truncate flex-1">{item.name} × {item.quantity}</span>
                        <span className="font-medium ml-2">₹{(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                <div className="flex justify-between sm:block">
                  <p className="text-xs sm:text-sm text-gray-600">
                    {cart.reduce((sum, i) => sum + i.quantity, 0)} item(s)
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900">
                    ₹{cart.reduce((sum, i) => sum + (parseFloat(i.price) * i.quantity), 0).toFixed(2)}
                  </p>
                </div>
                
                <button 
                  onClick={placeOrder}
                  disabled={cart.length === 0}
                  className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-red-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700 font-medium flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md"
                >
                  <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-sm sm:text-base">Place Order</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Waiter;