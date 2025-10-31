import React, { useState, useEffect } from 'react';
import { User, Plus, RefreshCw, Clock, X, Minus, Check } from 'lucide-react';
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
      toast.success('Order placed');
      setShowOrderModal(false);
      setCart([]);
      fetchData();
    } catch (error) {
      toast.error('Failed to place order');
    }
  };

  const categories = ['All', ...new Set(menuItems.map(item => item.category))];
  const filteredMenu = activeCategory === 'All' 
    ? menuItems 
    : menuItems.filter(item => item.category === activeCategory);

  const activeOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');

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
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="w-8 h-8 text-red-600" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Waiter</h1>
                <p className="text-xs text-gray-600 hidden sm:block">Manage tables & orders</p>
              </div>
            </div>
            <button 
              onClick={fetchData} 
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tables Grid */}
          <div className="bg-white rounded-xl p-4 sm:p-6 border">
            <h2 className="text-lg font-bold mb-4">Tables</h2>
            <div className="grid grid-cols-5 gap-3">
              {tables.map(table => (
                <button
                  key={table.id}
                  onClick={() => handleTableClick(table)}
                  className={`p-4 rounded-xl text-center transition-all ${
                    table.status === 'available' 
                      ? 'bg-green-50 border-2 border-green-500 hover:bg-green-100' 
                      : 'bg-red-50 border-2 border-red-500 hover:bg-red-100'
                  }`}
                >
                  <p className="font-bold text-lg">{table.number}</p>
                  <p className="text-xs mt-1 capitalize">{table.status}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Active Orders */}
          <div className="bg-white rounded-xl p-4 sm:p-6 border">
            <h2 className="text-lg font-bold mb-4">Active Orders ({activeOrders.length})</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activeOrders.map(order => (
                <div key={order.id} className="p-4 bg-gray-50 rounded-lg border">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-lg">Table {order.table?.number}</span>
                    <span className={`text-xs px-3 py-1 rounded-full ${
                      order.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                      order.status === 'preparing' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {new Date(order.createdAt).toLocaleTimeString()}
                    </p>
                    <p className="font-semibold text-gray-900">₹{parseFloat(order.total).toFixed(2)}</p>
                  </div>
                </div>
              ))}
              {activeOrders.length === 0 && (
                <p className="text-center text-gray-500 py-8">No active orders</p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Order Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">New Order - Table {selectedTable?.number}</h2>
              <button 
                onClick={() => setShowOrderModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Categories */}
            <div className="px-4 py-3 border-b overflow-x-auto">
              <div className="flex gap-2">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium ${
                      activeCategory === cat
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredMenu.map(item => {
                  const cartItem = cart.find(i => i.id === item.id);
                  return (
                    <div key={item.id} className="p-4 bg-gray-50 rounded-lg flex justify-between items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{item.name}</h3>
                        <p className="text-sm text-gray-600">₹{item.price}</p>
                      </div>
                      {cartItem ? (
                        <div className="flex items-center gap-2 bg-red-600 text-white rounded-lg">
                          <button onClick={() => removeFromCart(item.id)} className="p-2 hover:bg-red-700 rounded-lg">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-bold">{cartItem.quantity}</span>
                          <button onClick={() => addToCart(item)} className="p-2 hover:bg-red-700 rounded-lg">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => addToCart(item)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">{cart.reduce((sum, i) => sum + i.quantity, 0)} items</p>
                  <p className="text-2xl font-bold">
                    ₹{cart.reduce((sum, i) => sum + (parseFloat(i.price) * i.quantity), 0).toFixed(2)}
                  </p>
                </div>
                <button 
                  onClick={placeOrder}
                  disabled={cart.length === 0}
                  className="px-8 py-3 bg-red-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700 font-medium flex items-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Place Order
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