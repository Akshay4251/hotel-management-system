import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Minus, ShoppingCart, Home, Leaf, Drumstick, Trash2, X, Search, ChevronRight, Receipt } from 'lucide-react';
import { menuAPI, ordersAPI } from '../services/api';
import toast from 'react-hot-toast';
import { useSocket } from '../context/SocketContext.jsx';

const defaultFoodImages = {
  'Starters': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop',
  'Main Course': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop',
  'Breads': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop',
  'Beverages': 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=300&fit=crop',
  'Desserts': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&h=300&fit=crop',
  'default': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop'
};

const foodImages = {
  'Paneer Tikka': 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop',
  'Chicken Wings': 'https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=400&h=300&fit=crop',
  'Veg Biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=300&fit=crop',
  'Chicken Biryani': 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400&h=300&fit=crop',
  'Dal Makhani': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=300&fit=crop',
  'Butter Chicken': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400&h=300&fit=crop',
  'Naan': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop',
  'Garlic Naan': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&h=300&fit=crop',
  'Gulab Jamun': 'https://images.unsplash.com/photo-1571605800585-18ba15e7f3e5?w=400&h=300&fit=crop',
  'Ice Cream': 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=400&h=300&fit=crop'
};

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
    }
  }, [socket, tableNumber]);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const response = await menuAPI.getAll({ available: true });
      setMenuItems(response.data.data || []);
    } catch (error) {
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
      }
    } catch (error) {
      console.error('No existing order found');
    }
  };

  const loadCartFromStorage = () => {
    const savedCart = localStorage.getItem(`cart_table_${tableNumber}`);
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  };

  const saveCartToStorage = () => {
    localStorage.setItem(`cart_table_${tableNumber}`, JSON.stringify(cart));
  };

  const categories = ['All', ...new Set(menuItems.map(item => item.category))];

  const filteredItems = menuItems.filter(item => {
    const categoryMatch = activeCategory === 'All' || item.category === activeCategory;
    const vegMatch = !vegOnly || item.isVeg;
    const searchMatch = !searchQuery || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return categoryMatch && vegMatch && searchMatch;
  });

  const addToCart = (item) => {
    const existingItem = cart.find(i => i.id === item.id);
    if (existingItem) {
      setCart(cart.map(i => 
        i.id === item.id 
          ? { ...i, quantity: i.quantity + 1 }
          : i
      ));
    } else {
      setCart([...cart, { ...item, menuItemId: item.id, quantity: 1 }]);
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
    }
  };

  const clearCart = () => {
    setCart([]);
    setShowCart(false);
  };

  const deleteFromExistingOrder = async (itemId) => {
    if (!existingOrder || !window.confirm('Remove this item?')) return;

    try {
      const response = await ordersAPI.deleteItem(existingOrder.id, itemId);
      
      if (response.data.orderCancelled) {
        setExistingOrder(null);
        toast.success('Order cancelled');
      } else {
        fetchExistingOrder();
      }
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;

    setOrdering(true);
    try {
      if (existingOrder) {
        await ordersAPI.addItems(existingOrder.id, cart.map(item => ({
          menuItemId: item.id,
          quantity: item.quantity,
        })));
        toast.success('Items added to order');
      } else {
        await ordersAPI.create({
          tableNumber: parseInt(tableNumber),
          items: cart.map(item => ({
            menuItemId: item.id,
            quantity: item.quantity,
          })),
          type: 'dine-in',
        });
        toast.success('Order placed successfully');
      }

      setCart([]);
      setShowCart(false);
      localStorage.removeItem(`cart_table_${tableNumber}`);
      fetchExistingOrder();
      
    } catch (error) {
      if (error.response?.data?.orderId) {
        fetchExistingOrder();
      }
      toast.error('Failed to place order');
    } finally {
      setOrdering(false);
    }
  };

  const getItemImage = (item) => {
    return foodImages[item.name] || defaultFoodImages[item.category] || defaultFoodImages['default'];
  };

  const cartTotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <Home className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Table {tableNumber}</h2>
                <p className="text-xs text-gray-600 hidden sm:block">
                  {existingOrder ? `Order #${existingOrder.orderNumber}` : 'Browse menu'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setVegOnly(!vegOnly)}
                className={`p-2 rounded-lg ${
                  vegOnly 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Leaf className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="mt-3 relative">
            <input
              type="text"
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </div>
      </header>

      {/* Categories */}
      <div className="sticky top-[120px] sm:top-[96px] z-30 bg-white border-b">
        <div className="px-4 py-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
                  activeCategory === category
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Current Order Modal */}
      {showCurrentOrder && existingOrder && (
        <div 
          className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowCurrentOrder(false)}
        >
          <div 
            className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <h3 className="text-lg font-bold">Order #{existingOrder.orderNumber}</h3>
              <button
                onClick={() => setShowCurrentOrder(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3">
              {existingOrder.items?.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{item.menuItem?.name}</p>
                    <p className="text-sm text-gray-600">
                      {item.quantity} × ₹{parseFloat(item.price).toFixed(2)}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded-full inline-block mt-1 ${
                      item.status === 'served' ? 'bg-green-100 text-green-700' :
                      item.status === 'preparing' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteFromExistingOrder(item.id)}
                    className={`p-2 rounded-lg ml-2 ${
                      item.status === 'served' 
                        ? 'text-gray-400 cursor-not-allowed' 
                        : 'text-red-600 hover:bg-red-50'
                    }`}
                    disabled={item.status === 'served'}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
              <div className="pt-3 border-t">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-red-600">₹{parseFloat(existingOrder.total).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Sidebar */}
      {showCart && (
        <div 
          className="fixed inset-0 backdrop-blur-sm z-50 flex justify-end"
          onClick={() => setShowCart(false)}
        >
          <div 
            className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex justify-between items-center bg-gradient-to-r from-red-600 to-red-700 text-white">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                <h3 className="text-lg font-bold">Your Cart ({cartCount})</h3>
              </div>
              <button
                onClick={() => setShowCart(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">Your cart is empty</p>
                  <p className="text-sm mt-2">Add items from the menu</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <img 
                      src={getItemImage(item)} 
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                      <p className="text-sm text-gray-600">₹{item.price}</p>
                    </div>
                    <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200">
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-bold">{item.quantity}</span>
                      <button 
                        onClick={() => addToCart(item)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-4 border-t bg-gray-50 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-medium">Subtotal</span>
                  <span className="text-2xl font-bold text-gray-900">₹{cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={clearCart}
                    className="flex-1 px-4 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                  >
                    Clear Cart
                  </button>
                  <button 
                    onClick={placeOrder}
                    disabled={ordering}
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                  >
                    {ordering ? 'Processing...' : existingOrder ? 'Add to Order' : 'Place Order'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Menu Items Grid */}
      <main className="px-4 py-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No items found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map(item => {
              const cartItem = cart.find(i => i.id === item.id);
              return (
                <div key={item.id} className="bg-white rounded-xl overflow-hidden border hover:shadow-lg transition-shadow">
                  <div className="relative h-40 bg-gray-100">
                    <img 
                      src={getItemImage(item)} 
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = defaultFoodImages['default'];
                      }}
                    />
                    <div className={`absolute top-2 right-2 p-1.5 rounded-full ${item.isVeg ? 'bg-green-500' : 'bg-red-500'}`}>
                      {item.isVeg ? (
                        <Leaf className="w-4 h-4 text-white" />
                      ) : (
                        <Drumstick className="w-4 h-4 text-white" />
                      )}
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 mb-1 truncate">{item.name}</h3>
                    {item.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <p className="text-xl font-bold text-gray-900">₹{item.price}</p>
                      
                      {cartItem ? (
                        <div className="flex items-center gap-2 bg-red-600 text-white rounded-lg">
                          <button 
                            onClick={() => removeFromCart(item.id)}
                            className="p-2 hover:bg-red-700 rounded-lg"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-bold">{cartItem.quantity}</span>
                          <button 
                            onClick={() => addToCart(item)}
                            className="p-2 hover:bg-red-700 rounded-lg"
                          >
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Action Buttons - Bottom Right */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
        {/* View Order Button */}
        {existingOrder && (
          <button
            onClick={() => setShowCurrentOrder(true)}
            className="relative bg-blue-600 text-white rounded-full p-4 shadow-2xl hover:bg-blue-700 transition-all hover:scale-110"
            title="View Current Order"
          >
            <Receipt className="w-6 h-6" />
            {existingOrder.items?.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-yellow-400 text-gray-900 text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-lg">
                {existingOrder.items.length}
              </span>
            )}
          </button>
        )}

        {/* Cart Button */}
        <button
          onClick={() => setShowCart(true)}
          className="relative bg-red-600 text-white rounded-full p-4 shadow-2xl hover:bg-red-700 transition-all hover:scale-110"
          title="View Cart"
        >
          <ShoppingCart className="w-6 h-6" />
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-yellow-400 text-gray-900 text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-lg">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Bottom Cart Bar (Desktop) */}
      {cart.length > 0 && (
        <div className="hidden sm:block fixed bottom-0 left-0 right-0 bg-white border-t shadow-xl z-30">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{cartCount} item{cartCount > 1 ? 's' : ''}</p>
                <p className="text-2xl font-bold text-gray-900">₹{cartTotal.toFixed(2)}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCart(true)}
                  className="px-6 py-3 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 font-medium"
                >
                  View Cart
                </button>
                <button 
                  onClick={placeOrder}
                  disabled={ordering}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {ordering ? 'Processing...' : existingOrder ? 'Add to Order' : 'Place Order'}
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Menu;