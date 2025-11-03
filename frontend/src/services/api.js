import axios from 'axios';

// ============================================
// API CONFIGURATION
// ============================================
const isDevelopment = import.meta.env.DEV;

const API_BASE_URL = isDevelopment 
  ? 'http://localhost:5000/api'
  : '/api';

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
  timeout: 30000
});

// ============================================
// REQUEST INTERCEPTOR
// ============================================
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
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
  getAll: (params) => api.get('/tables', { params }),
  getById: (id) => api.get(`/tables/${id}`),
  verify: (tableNumber) => api.post('/tables/verify', { tableNumber }),
  create: (data) => api.post('/tables', data),
  update: (id, data) => api.put(`/tables/${id}`, data),
  updateStatus: (id, status) => api.put(`/tables/${id}/status`, { status }),
  delete: (id) => api.delete(`/tables/${id}`),
  generateQR: (id) => api.post(`/tables/${id}/qr`),
};

// ============================================
// MENU API
// ============================================
export const menuAPI = {
  getAll: (params) => api.get('/menu', { params }),
  getById: (id) => api.get(`/menu/${id}`),
  getCategories: () => api.get('/menu/categories'),
  create: (data) => api.post('/menu', data),
  update: (id, data) => api.put(`/menu/${id}`, data),
  delete: (id) => api.delete(`/menu/${id}`),
  updateAvailability: (id, isAvailable) => 
    api.patch(`/menu/${id}/availability`, { isAvailable }),
  bulkUpdateAvailability: (ids, isAvailable) =>
    api.post('/menu/bulk-availability', { ids, isAvailable }),
  uploadImage: (formData) => api.post('/menu/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteImage: (imageUrl) => api.post('/menu/delete-image', { imageUrl }),
};

// ============================================
// ORDERS API (FIXED - NO DEBUG ENDPOINTS)
// ============================================
export const ordersAPI = {
  // Get all orders
  getAll: (params) => api.get('/orders', { params }),
  
  // Get single order by ID
  getById: (orderId) => api.get(`/orders/${orderId}`),
  
  // Get active order for a table
  getByTable: (tableNumber) => {
    console.log('🔍 Fetching order for table:', tableNumber);
    return api.get(`/orders/table/${tableNumber}`);
  },
  
  // Get KOT
  getKOT: (orderId) => api.get(`/orders/${orderId}/kot`),
  
  // ✅ CREATE ORDER - SIMPLIFIED (Backend handles all validation)
  create: async (orderData) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 CREATING ORDER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Data:', JSON.stringify(orderData, null, 2));
    
    try {
      // Send directly to backend - it will validate everything
      const response = await api.post('/orders', orderData);
      
      console.log('✅ Order created successfully');
      console.log('Order:', response.data);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      return response;
    } catch (error) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ ORDER ERROR');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('Error:', error.response?.data || error.message);
      console.error('Response:', error.response?.data);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      throw error;
    }
  },
  
  // Add items to existing order
  addItems: async (orderId, items) => {
    console.log('📤 Adding items to order:', orderId, items);
    return api.post(`/orders/${orderId}/items`, { items });
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
  
  // Delete item from order
  deleteItem: (orderId, itemId) => {
    console.log('🗑️ Deleting item:', { orderId, itemId });
    return api.delete(`/orders/${orderId}/items/${itemId}`);
  },
  
  // Cancel entire order
  cancel: (orderId) => {
    console.log('🗑️ Cancelling order:', orderId);
    return api.delete(`/orders/${orderId}`);
  },
};

// ============================================
// BILLS API
// ============================================
export const billsAPI = {
  getAll: (params) => api.get('/bills', { params }),
  getById: (billId) => api.get(`/bills/${billId}`),
  getByOrder: (orderId) => api.get(`/bills/order/${orderId}`),
  generate: (orderId) => api.post(`/bills/generate/${orderId}`),
  settle: (billId, paymentData) => 
    api.post(`/bills/${billId}/settle`, paymentData),
  print: (billId) => api.get(`/bills/${billId}/print`),
};

// ============================================
// ADMIN/REPORTS API
// ============================================
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getRevenueReport: (startDate, endDate) => 
    api.get('/admin/reports/revenue', { 
      params: { startDate, endDate } 
    }),
  getSalesReport: (startDate, endDate) =>
    api.get('/admin/reports/sales', {
      params: { startDate, endDate }
    }),
  getMenuPerformance: () => api.get('/admin/reports/menu-performance'),
  getTableOccupancy: () => api.get('/admin/reports/table-occupancy'),
  getStaffPerformance: (startDate, endDate) =>
    api.get('/admin/reports/staff', {
      params: { startDate, endDate }
    }),
};

// ============================================
// USERS API
// ============================================
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  updateRole: (id, role) => api.put(`/users/${id}/role`, { role }),
};

export default api;