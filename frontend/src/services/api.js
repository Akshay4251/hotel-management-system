import axios from 'axios';

// ============================================
// API CONFIGURATION
// ============================================
const isDevelopment = import.meta.env.DEV;

const API_BASE_URL = isDevelopment 
  ? 'http://localhost:5000/api'  // Development
  : '/api';                       // Production (same domain)

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔧 API CONFIGURATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Environment:', isDevelopment ? 'Development' : 'Production');
console.log('Base URL:', API_BASE_URL);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ============================================
// CREATE AXIOS INSTANCE
// ============================================
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 30000 // 30 seconds
});

// ============================================
// REQUEST INTERCEPTOR
// ============================================
api.interceptors.request.use(
  (config) => {
    // Add auth token if exists
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log request in development
    if (isDevelopment) {
      console.log('📤 API Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        data: config.data
      });
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// ============================================
// RESPONSE INTERCEPTOR
// ============================================
api.interceptors.response.use(
  (response) => {
    // Log response in development
    if (isDevelopment) {
      console.log('📥 API Response:', {
        url: response.config.url,
        status: response.status,
        data: response.data
      });
    }
    return response;
  },
  (error) => {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ API ERROR');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('URL:', error.config?.url);
    console.error('Method:', error.config?.method?.toUpperCase());
    console.error('Status:', error.response?.status);
    console.error('Message:', error.message);
    console.error('Response Data:', error.response?.data);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    
    return Promise.reject(error);
  }
);

// ============================================
// AUTHENTICATION API
// ============================================
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  },
  getCurrentUser: () => api.get('/auth/me'),
};

// ============================================
// TABLES API
// ============================================
export const tablesAPI = {
  // Get all tables
  getAll: (params) => api.get('/tables', { params }),
  
  // Get single table
  getById: (id) => api.get(`/tables/${id}`),
  
  // Verify table number (for customer landing)
  verify: (tableNumber) => api.post('/tables/verify', { tableNumber }),
  
  // Create new table
  create: (data) => api.post('/tables', data),
  
  // Update table
  update: (id, data) => api.put(`/tables/${id}`, data),
  
  // Update table status
  updateStatus: (id, status) => api.put(`/tables/${id}/status`, { status }),
  
  // Delete table
  delete: (id) => api.delete(`/tables/${id}`),
  
  // Generate QR code for table
  generateQR: (id) => api.post(`/tables/${id}/qr`),
};

// ============================================
// MENU API
// ============================================
export const menuAPI = {
  // Get all menu items
  getAll: (params) => api.get('/menu', { params }),
  
  // Get single menu item
  getById: (id) => api.get(`/menu/${id}`),
  
  // Get categories
  getCategories: () => api.get('/menu/categories'),
  
  // Create menu item
  create: (data) => api.post('/menu', data),
  
  // Update menu item
  update: (id, data) => api.put(`/menu/${id}`, data),
  
  // Delete menu item
  delete: (id) => api.delete(`/menu/${id}`),
  
  // Update availability
  updateAvailability: (id, isAvailable) => 
    api.patch(`/menu/${id}/availability`, { isAvailable }),
  
  // Bulk update availability
  bulkUpdateAvailability: (ids, isAvailable) =>
    api.post('/menu/bulk-availability', { ids, isAvailable }),
  
  // Upload image
  uploadImage: (formData) => api.post('/menu/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  
  // Delete image
  deleteImage: (imageUrl) => api.post('/menu/delete-image', { imageUrl }),
};

// ============================================
// ORDERS API (COMPLETE)
// ============================================
export const ordersAPI = {
  // ========================================
  // GET OPERATIONS
  // ========================================
  
  // Get all orders with optional filters
  getAll: (params) => api.get('/orders', { params }),
  
  // Get single order by ID
  getById: (orderId) => api.get(`/orders/${orderId}`),
  
  // Get active order for a table
  getByTable: (tableNumber) => {
    console.log('🔍 Fetching order for table:', tableNumber);
    return api.get(`/orders/table/${tableNumber}`);
  },
  
  // Get KOT (Kitchen Order Ticket) for printing
  getKOT: (orderId) => api.get(`/orders/${orderId}/kot`),
  
  // ========================================
  // CREATE OPERATIONS
  // ========================================
  
  // Create new order (FIXED with validation)
  create: async (data) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 CREATING ORDER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Raw data:', data);
    
    // ============================================
    // VALIDATION
    // ============================================
    if (!data.tableNumber) {
      const error = new Error('Table number is required');
      console.error('❌', error.message);
      throw error;
    }
    
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      const error = new Error('At least one item is required');
      console.error('❌', error.message);
      throw error;
    }
    
    // ============================================
    // VALIDATE & FORMAT ITEMS
    // ============================================
    const validatedItems = data.items.map((item, index) => {
      // Get menuItemId from either menuItemId or id field
      const menuItemId = item.menuItemId || item.id;
      
      if (!menuItemId) {
        console.error('❌ Invalid item at index', index, ':', item);
        throw new Error(`Item at index ${index} is missing menuItemId`);
      }
      
      const quantity = parseInt(item.quantity);
      if (!quantity || quantity < 1) {
        throw new Error(`Invalid quantity for item at index ${index}`);
      }
      
      return {
        menuItemId: menuItemId, // UUID string
        quantity: quantity,
        notes: item.notes || null
      };
    });
    
    // ============================================
    // BUILD PAYLOAD
    // ============================================
    const payload = {
      tableNumber: parseInt(data.tableNumber),
      items: validatedItems,
      type: data.type || 'dine-in',
      waiterId: data.waiterId || null,
      notes: data.notes || null
    };
    
    console.log('✅ Validated payload:', JSON.stringify(payload, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      const response = await api.post('/orders', payload);
      console.log('✅ Order created successfully:', response.data);
      return response;
    } catch (error) {
      console.error('❌ Order creation failed:', error.response?.data || error.message);
      throw error;
    }
  },
  
  // ========================================
  // UPDATE OPERATIONS
  // ========================================
  
  // Add items to existing order
  addItems: async (orderId, items) => {
    console.log('📤 Adding items to order:', orderId);
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Items array is required');
    }
    
    const validatedItems = items.map(item => {
      const menuItemId = item.menuItemId || item.id;
      
      if (!menuItemId) {
        console.error('❌ Invalid item:', item);
        throw new Error('Each item must have a menuItemId');
      }
      
      return {
        menuItemId: menuItemId,
        quantity: parseInt(item.quantity) || 1,
        notes: item.notes || null
      };
    });
    
    console.log('Validated items:', validatedItems);
    
    return api.post(`/orders/${orderId}/items`, { items: validatedItems });
  },
  
  // Update order status
  updateStatus: (orderId, status) => 
    api.put(`/orders/${orderId}/status`, { status }),
  
  // Update order item status
  updateItemStatus: (orderId, itemId, status, extras = {}) => 
    api.put(`/orders/${orderId}/items/${itemId}/status`, { 
      status, 
      ...extras 
    }),
  
  // ========================================
  // DELETE OPERATIONS
  // ========================================
  
  // Delete item from order
  deleteItem: (orderId, itemId) => {
    console.log('🗑️  Deleting item:', { orderId, itemId });
    return api.delete(`/orders/${orderId}/items/${itemId}`);
  },
  
  // Cancel entire order
  cancel: (orderId) => {
    console.log('🗑️  Cancelling order:', orderId);
    return api.delete(`/orders/${orderId}`);
  },
};

// ============================================
// BILLS API
// ============================================
export const billsAPI = {
  // Get all bills
  getAll: (params) => api.get('/bills', { params }),
  
  // Get single bill
  getById: (billId) => api.get(`/bills/${billId}`),
  
  // Get bill by order ID
  getByOrder: (orderId) => api.get(`/bills/order/${orderId}`),
  
  // Generate bill for order
  generate: (orderId) => api.post(`/bills/generate/${orderId}`),
  
  // Settle/pay bill
  settle: (billId, paymentData) => 
    api.post(`/bills/${billId}/settle`, paymentData),
  
  // Print bill
  print: (billId) => api.get(`/bills/${billId}/print`),
};

// ============================================
// ADMIN/REPORTS API
// ============================================
export const adminAPI = {
  // Dashboard stats
  getDashboard: () => api.get('/admin/dashboard'),
  
  // Revenue reports
  getRevenueReport: (startDate, endDate) => 
    api.get('/admin/reports/revenue', { 
      params: { startDate, endDate } 
    }),
  
  // Sales reports
  getSalesReport: (startDate, endDate) =>
    api.get('/admin/reports/sales', {
      params: { startDate, endDate }
    }),
  
  // Menu performance
  getMenuPerformance: () => api.get('/admin/reports/menu-performance'),
  
  // Table occupancy
  getTableOccupancy: () => api.get('/admin/reports/table-occupancy'),
  
  // Staff performance
  getStaffPerformance: (startDate, endDate) =>
    api.get('/admin/reports/staff', {
      params: { startDate, endDate }
    }),
};

// ============================================
// USERS API (if you have user management)
// ============================================
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  updateRole: (id, role) => api.put(`/users/${id}/role`, { role }),
};

// ============================================
// EXPORT DEFAULT API INSTANCE
// ============================================
export default api;