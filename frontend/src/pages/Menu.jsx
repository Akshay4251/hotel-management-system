import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Minus, ShoppingCart, Home, Leaf, Drumstick, Trash2, X, Search, ChevronRight, Receipt, Sparkles } from 'lucide-react';
import { menuAPI, ordersAPI } from '../services/api';
import toast from 'react-hot-toast';
import { useSocket } from '../context/SocketContext.jsx';

const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:5000' : 'https://hotel-management-system-2lsk.onrender.com';

// Skeleton Loader Component
const MenuItemSkeleton = () => (
  <div className="bg-white rounded-2xl overflow-hidden border-2 border-gray-100 animate-pulse">
    <div className="h-52 bg-gray-200"></div>
    <div className="p-5 space-y-3">
      <div className="h-6 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-full"></div>
      <div className="flex justify-between items-center">
        <div className="h-8 bg-gray-200 rounded w-20"></div>
        <div className="h-10 bg-gray-200 rounded w-24"></div>
      </div>
    </div>
  </div>
);

function Menu() {
  const { tableNumber } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [vegOnly, setVegOnly] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [existingOrder, setExistingOrder] = useState(null);
  const [showCurrentOrder, setShowCurrentOrder] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    fetchMenu();
    fetchExistingOrder();
    loadCartFromStorage();
  }, []);

  useEffect(() => {
    saveCartToStorage();
  }, [cart]);

  useEffect(() => {
    if (socket) {
      socket.on('order-updated', (order) => {
        if (order.table?.number === parseInt(tableNumber)) {
          setExistingOrder(order);
        }
      });

      socket.on('order-cancelled', (order) => {
        if (order.table?.number === parseInt(tableNumber)) {
          setExistingOrder(null);
        }
      });

      return () => {
        socket.off('order-updated');
        socket.off('order-cancelled');
      };
    }
  }, [socket, tableNumber]);

  // ============================================
  // ENHANCED FETCH MENU (STEP 5)
  // ============================================
  const fetchMenu = async () => {
    try {
      setLoading(true);
      const response = await menuAPI.getAll({ available: true });
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 MENU ITEMS LOADED FROM SERVER');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Environment:', import.meta.env.DEV ? 'Development' : 'Production');
      console.log('API URL:', import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');
      console.log('Count:', response.data.data?.length || 0);
      
      if (response.data.data && response.data.data.length > 0) {
        console.log('\n📦 First 5 Menu Items:');
        response.data.data.slice(0, 5).forEach((item, index) => {
          console.log(`${index + 1}. ${item.name}:`, {
            id: item.id,
            idType: typeof item.id,
            idLength: item.id?.length,
            price: item.price,
            category: item.category,
            available: item.isAvailable,
            isVeg: item.isVeg
          });
        });
        
        if (response.data.data.length > 5) {
          console.log(`\n... and ${response.data.data.length - 5} more items`);
        }
      } else {
        console.warn('⚠️  NO MENU ITEMS FOUND!');
        console.warn('Database might be empty. Check:', `${API_BASE_URL}/api/debug/menu-ids`);
      }
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      setMenuItems(response.data.data || []);
    } catch (error) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ MENU FETCH ERROR');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('Error:', error);
      console.error('Response:', error.response?.data);
      console.error('Status:', error.response?.status);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingOrder = async () => {
    try {
      const response = await ordersAPI.getByTable(tableNumber);
      if (response.data.data) {
        setExistingOrder(response.data.data);
        console.log('✅ Existing order found:', response.data.data.orderNumber);
      } else {
        console.log('ℹ️  No existing order for table', tableNumber);
      }
    } catch (error) {
      console.log('ℹ️  No existing order (or error fetching)');
    }
  };

  const loadCartFromStorage = () => {
    const savedCart = localStorage.getItem(`cart_table_${tableNumber}`);
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        setCart(parsedCart);
        console.log('✅ Cart loaded from localStorage:', parsedCart.length, 'items');
      } catch (error) {
        console.error('❌ Failed to parse cart from localStorage:', error);
        localStorage.removeItem(`cart_table_${tableNumber}`);
      }
    }
  };

  const saveCartToStorage = () => {
    if (cart.length > 0) {
      localStorage.setItem(`cart_table_${tableNumber}`, JSON.stringify(cart));
    } else {
      localStorage.removeItem(`cart_table_${tableNumber}`);
    }
  };

  const categories = ['All', ...new Set(menuItems.map(item => item.category))];

  const filteredItems = menuItems.filter(item => {
    const categoryMatch = activeCategory === 'All' || item.category === activeCategory;
    const vegMatch = !vegOnly || item.isVeg;
    const searchMatch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return categoryMatch && vegMatch && searchMatch && item.isAvailable;
  });

  const addToCart = (item) => {
  console.log('🛒 Adding to cart:', {
    name: item.name,
    id: item.id,
    idType: typeof item.id,
    fullItem: item
  });
  
  const existingItem = cart.find(i => i.id === item.id);
  if (existingItem) {
    setCart(cart.map(i => 
      i.id === item.id 
        ? { ...i, quantity: i.quantity + 1 }
        : i
    ));
    toast.success(`${item.name} quantity increased`, { duration: 1000 });
  } else {
    // ✅ Ensure we're storing the correct ID
    const cartItem = {
      ...item,
      menuItemId: item.id, // Redundant but safe
      quantity: 1
    };
    
    console.log('📦 Cart item created:', cartItem);
    
    setCart([...cart, cartItem]);
    toast.success(`${item.name} added to cart`, { duration: 1000, icon: '🛒' });
  }
};

  const removeFromCart = (itemId) => {
    const existingItem = cart.find(i => i.id === itemId);
    if (existingItem && existingItem.quantity > 1) {
      setCart(cart.map(i => 
        i.id === itemId 
          ? { ...i, quantity: i.quantity - 1 }
          : i
      ));
    } else {
      setCart(cart.filter(i => i.id !== itemId));
      toast('Item removed from cart', { icon: '🗑️', duration: 1000 });
    }
  };

  const clearCart = () => {
    if (window.confirm('Clear all items from cart?')) {
      setCart([]);
      toast.success('Cart cleared');
    }
  };

  const deleteFromExistingOrder = async (itemId) => {
    if (!existingOrder || !window.confirm('Remove this item from your order?')) return;

    try {
      const response = await ordersAPI.deleteItem(existingOrder.id, itemId);
      
      if (response.data.orderCancelled) {
        setExistingOrder(null);
        toast.success('Order cancelled');
      } else {
        fetchExistingOrder();
        toast.success('Item removed');
      }
    } catch (error) {
      console.error('❌ Delete item error:', error);
      toast.error('Failed to remove item');
    }
  };

  // ============================================
  // ENHANCED PLACE ORDER (STEP 4)
  // ============================================
const placeOrder = async () => {
  if (cart.length === 0) {
    toast.error('Cart is empty');
    return;
  }

  setOrdering(true);
  
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🛒 PLACING ORDER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Cart Items:', cart.length);
    console.log('Table Number:', tableNumber);
    
    // Prepare order data
    const orderData = {
      tableNumber: parseInt(tableNumber),
      items: cart.map(item => ({
        menuItemId: item.id,
        quantity: item.quantity
      })),
      type: 'dine-in'
    };
    
    console.log('Order Data:', JSON.stringify(orderData, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Create or add to order
    if (existingOrder) {
      console.log('Adding to existing order:', existingOrder.id);
      await ordersAPI.addItems(existingOrder.id, orderData.items);
      toast.success('Items added to your order! 🎉');
    } else {
      console.log('Creating new order...');
      const response = await ordersAPI.create(orderData);
      console.log('✅ Order created:', response.data);
      toast.success('Order placed successfully! 🎉');
    }

    // Clear cart and refresh
    setCart([]);
    setShowCart(false);
    localStorage.removeItem(`cart_table_${tableNumber}`);
    await fetchExistingOrder();
    
    console.log('✅ ORDER COMPLETED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ ORDER ERROR');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Error:', error);
    console.error('Response:', error.response?.data);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (error.response?.data?.orderId) {
      await fetchExistingOrder();
    }
    
    const errorMessage = error.response?.data?.message || 'Failed to place order';
    toast.error(errorMessage);
  } finally {
    setOrdering(false);
  }
};

  // Image URL helper
  const getItemImage = (item) => {
    if (!item.image) {
      return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f3f4f6' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='20' font-family='sans-serif'%3E${encodeURIComponent(item.name)}%3C/text%3E%3C/svg%3E`;
    }
    
    const imageUrl = item.image.startsWith('http') 
      ? item.image 
      : `${API_BASE_URL}${item.image}`;
    
    return imageUrl;
  };

  const cartTotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-red-50/20 to-gray-50">
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b shadow-sm">
          <div className="px-4 py-4">
            <div className="h-8 bg-gray-200 rounded w-32 animate-pulse"></div>
          </div>
        </header>
        <main className="px-4 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => <MenuItemSkeleton key={i} />)}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-red-50/20 to-gray-50 pb-24">
      {/* Enhanced Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b shadow-sm">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <Home className="w-5 h-5 text-gray-700" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  Table {tableNumber}
                  <Sparkles className="w-5 h-5 text-yellow-500" />
                </h2>
                <p className="text-xs text-gray-600">
                  {existingOrder ? (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      Order #{existingOrder.orderNumber}
                    </span>
                  ) : (
                    'Browse our delicious menu'
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => setVegOnly(!vegOnly)}
              className={`p-2.5 rounded-xl transition-all transform hover:scale-105 ${
                vegOnly 
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/50' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={vegOnly ? 'Show All' : 'Veg Only'}
            >
              <Leaf className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search dishes, categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
            />
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Categories */}
      <div className="sticky top-[140px] sm:top-[132px] z-30 bg-white/90 backdrop-blur-md border-b shadow-sm">
        <div className="px-4 py-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {categories.map(category => {
              const count = menuItems.filter(item => 
                (category === 'All' || item.category === category) && 
                (!vegOnly || item.isVeg) && 
                item.isAvailable
              ).length;
              
              return (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-5 py-2.5 rounded-xl whitespace-nowrap text-sm font-semibold transition-all transform hover:scale-105 ${
                    activeCategory === category
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-500/50'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border-2 border-gray-200'
                  }`}
                >
                  {category}
                  <span className={`ml-2 text-xs ${
                    activeCategory === category ? 'text-red-100' : 'text-gray-500'
                  }`}>
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Current Order Modal */}
      {showCurrentOrder && existingOrder && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowCurrentOrder(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] overflow-hidden shadow-2xl transform animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b flex justify-between items-center bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <div>
                <h3 className="text-xl font-bold">Current Order</h3>
                <p className="text-sm text-blue-100">#{existingOrder.orderNumber}</p>
              </div>
              <button
                onClick={() => setShowCurrentOrder(false)}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto max-h-[60vh] space-y-3">
              {existingOrder.items?.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border-2 border-gray-100 hover:border-blue-200 transition-all">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate text-lg">{item.menuItem?.name}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {item.quantity} × ₹{parseFloat(item.price).toFixed(2)}
                      <span className="ml-2 font-semibold text-gray-900">
                        = ₹{(item.quantity * parseFloat(item.price)).toFixed(2)}
                      </span>
                    </p>
                    <span className={`text-xs px-3 py-1 rounded-full inline-block mt-2 font-medium ${
                      item.status === 'served' ? 'bg-green-100 text-green-700' :
                      item.status === 'preparing' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteFromExistingOrder(item.id)}
                    className={`p-3 rounded-xl ml-3 transition-all ${
                      item.status === 'served' 
                        ? 'text-gray-400 cursor-not-allowed bg-gray-100' 
                        : 'text-red-600 hover:bg-red-50 hover:scale-110'
                    }`}
                    disabled={item.status === 'served'}
                    title={item.status === 'served' ? 'Already served' : 'Remove item'}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
              
              <div className="pt-4 border-t-2 border-gray-200 mt-4">
                <div className="flex justify-between items-center text-xl font-bold">
                  <span className="text-gray-700">Total Amount:</span>
                  <span className="text-green-600 text-2xl">₹{parseFloat(existingOrder.total).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Sidebar */}
      {showCart && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end animate-fadeIn"
          onClick={() => setShowCart(false)}
        >
          <div 
            className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl transform animate-slideLeft"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b flex justify-between items-center bg-gradient-to-r from-red-600 to-red-700 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Your Cart</h3>
                  <p className="text-sm text-red-100">{cartCount} item{cartCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <button
                onClick={() => setShowCart(false)}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {cart.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShoppingCart className="w-12 h-12 text-gray-400" />
                  </div>
                  <p className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</p>
                  <p className="text-gray-600">Add some delicious items from our menu!</p>
                </div>
              ) : (
                cart.map(item => {
                  const imageUrl = getItemImage(item);
                  
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-xl hover:shadow-md transition-all border-2 border-gray-100">
                      <img 
                        src={imageUrl} 
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect fill='%23f3f4f6' width='80' height='80'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='12'%3ENo Image%3C/text%3E%3C/svg%3E`;
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 truncate">{item.name}</p>
                        <p className="text-sm text-gray-600">₹{parseFloat(item.price).toFixed(2)}</p>
                        <p className="text-xs font-semibold text-red-600 mt-1">
                          Total: ₹{(item.quantity * parseFloat(item.price)).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 bg-gray-100 rounded-xl border-2 border-gray-200">
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="p-2 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-10 text-center font-bold text-lg">{item.quantity}</span>
                        <button 
                          onClick={() => addToCart(item)}
                          className="p-2 hover:bg-green-100 hover:text-green-600 rounded-lg transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-5 border-t-2 bg-white space-y-4 shadow-2xl">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-gray-700">
                    <span className="font-medium">Subtotal ({cartCount} items)</span>
                    <span className="font-semibold">₹{cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold text-gray-900">Total</span>
                    <span className="text-3xl font-bold text-green-600">₹{cartTotal.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <button
                    onClick={clearCart}
                    className="flex-1 px-4 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-red-500 hover:text-red-600 transition-all"
                  >
                    Clear
                  </button>
                  <button 
                    onClick={placeOrder}
                    disabled={ordering}
                    className="flex-[2] px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-bold hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-500/50 hover:shadow-xl hover:shadow-red-500/60 transform hover:scale-105 disabled:transform-none"
                  >
                    {ordering ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                      </span>
                    ) : (
                      existingOrder ? 'Add to Order' : 'Place Order'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Menu Grid */}
      <main className="px-4 py-6">
        {filteredItems.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-12 h-12 text-gray-400" />
            </div>
            <p className="text-xl font-bold text-gray-900 mb-2">No items found</p>
            <p className="text-gray-600 mb-6">Try adjusting your filters or search term</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('All');
                setVegOnly(false);
              }}
              className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium transition-colors"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredItems.map(item => {
              const cartItem = cart.find(i => i.id === item.id);
              const imageUrl = getItemImage(item);
              
              return (
                <div key={item.id} className="bg-white rounded-2xl overflow-hidden border-2 border-gray-100 hover:border-red-500 hover:shadow-2xl transition-all duration-300 transform hover:scale-105 group">
                  <div className="relative h-52 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                    <img 
                      src={imageUrl} 
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23f3f4f6' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='16' font-family='sans-serif'%3E${encodeURIComponent(item.name)}%3C/text%3E%3C/svg%3E`;
                      }}
                    />
                    <div className={`absolute top-3 left-3 p-2 rounded-xl backdrop-blur-md shadow-lg ${
                      item.isVeg 
                        ? 'bg-green-500/90 shadow-green-500/50' 
                        : 'bg-red-500/90 shadow-red-500/50'
                    }`}>
                      {item.isVeg ? (
                        <Leaf className="w-5 h-5 text-white" />
                      ) : (
                        <Drumstick className="w-5 h-5 text-white" />
                      )}
                    </div>
                    {cartItem && (
                      <div className="absolute top-3 right-3 px-3 py-1.5 bg-red-600 text-white rounded-full text-xs font-bold shadow-lg animate-bounce">
                        {cartItem.quantity} in cart
                      </div>
                    )}
                  </div>
                  
                  <div className="p-5">
                    <h3 className="font-bold text-gray-900 mb-2 text-lg truncate group-hover:text-red-600 transition-colors">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between mt-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Price</p>
                        <p className="text-2xl font-bold text-gray-900">₹{parseFloat(item.price).toFixed(2)}</p>
                      </div>
                      
                      {cartItem ? (
                        <div className="flex items-center gap-2 bg-red-600 text-white rounded-xl shadow-lg">
                          <button 
                            onClick={() => removeFromCart(item.id)}
                            className="p-3 hover:bg-red-700 rounded-xl transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-10 text-center font-bold text-lg">{cartItem.quantity}</span>
                          <button 
                            onClick={() => addToCart(item)}
                            className="p-3 hover:bg-red-700 rounded-xl transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => addToCart(item)}
                          className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 font-bold transition-all shadow-lg shadow-red-500/50 hover:shadow-xl hover:shadow-red-500/60 transform hover:scale-105"
                        >
                          Add +
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
        {existingOrder && (
          <button
            onClick={() => setShowCurrentOrder(true)}
            className="relative bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full p-4 shadow-2xl hover:shadow-blue-500/50 transition-all hover:scale-110 group"
            title="View Current Order"
          >
            <Receipt className="w-7 h-7" />
            {existingOrder.items?.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-yellow-400 text-gray-900 text-xs rounded-full w-7 h-7 flex items-center justify-center font-bold shadow-lg animate-pulse">
                {existingOrder.items.length}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setShowCart(true)}
          className="relative bg-gradient-to-r from-red-600 to-red-700 text-white rounded-full p-4 shadow-2xl hover:shadow-red-500/50 transition-all hover:scale-110 group"
          title="View Cart"
        >
          <ShoppingCart className="w-7 h-7" />
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-yellow-400 text-gray-900 text-xs rounded-full w-7 h-7 flex items-center justify-center font-bold shadow-lg animate-pulse">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Bottom Cart Bar (Desktop) */}
      {cart.length > 0 && (
        <div className="hidden sm:block fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t-2 shadow-2xl z-30 animate-slideUp">
          <div className="max-w-7xl mx-auto px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">{cartCount} item{cartCount !== 1 ? 's' : ''} added</p>
                <p className="text-3xl font-bold text-gray-900">₹{cartTotal.toFixed(2)}</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowCart(true)}
                  className="px-6 py-4 bg-white border-2 border-gray-300 text-gray-900 rounded-xl hover:border-red-600 hover:text-red-600 font-bold transition-all transform hover:scale-105"
                >
                  View Cart
                </button>
                <button 
                  onClick={placeOrder}
                  disabled={ordering}
                  className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 font-bold disabled:opacity-50 flex items-center gap-3 transition-all shadow-lg shadow-red-500/50 transform hover:scale-105 disabled:transform-none"
                >
                  {ordering ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      {existingOrder ? 'Add to Order' : 'Place Order'}
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideLeft {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
        .animate-slideLeft {
          animation: slideLeft 0.3s ease-out;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

export default Menu;