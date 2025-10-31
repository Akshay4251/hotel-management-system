import axios from 'axios';

// ===== DYNAMIC API CONFIGURATION =====
const isDevelopment = import.meta.env.DEV;

// In production: Use relative URLs (same domain)
// In development: Use localhost
const API_BASE_URL = isDevelopment 
  ? 'http://localhost:5000/api' 
  : '/api';

console.log('🔧 API Environment:', isDevelopment ? 'Development' : 'Production');
console.log('🔗 API Base URL:', API_BASE_URL);

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000
});

// Request interceptor for adding token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// ===== ORDERS API =====
export const ordersAPI = {
  getAll: (params) => api.get('/orders', { params }),
  getByTable: (tableNumber) => api.get(`/orders/table/${tableNumber}`),
  create: (data) => api.post('/orders', data),
  updateItemStatus: (orderId, itemId, status) => 
    api.put(`/orders/${orderId}/items/${itemId}/status`, { status }),
  addItems: (orderId, items) => 
    api.post(`/orders/${orderId}/items`, { items }),
  deleteItem: (orderId, itemId) =>
    api.delete(`/orders/${orderId}/items/${itemId}`),
};

// ===== BILLS API =====
export const billsAPI = {
  generate: (orderId) => api.post(`/bills/generate/${orderId}`),
  settle: (billId, paymentData) => api.post(`/bills/${billId}/settle`, paymentData),
  getById: (billId) => api.get(`/bills/${billId}`),
};

// ===== ADMIN API =====
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getRevenueReport: (startDate, endDate) => 
    api.get('/admin/reports/revenue', { params: { startDate, endDate } }),
};

// ===== AUTH API =====
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
};

// Add these to your existing tablesAPI object
export const tablesAPI = {
  getAll: () => api.get('/tables'),
  verify: (tableNumber) => api.post('/tables/verify', { tableNumber }),
  updateStatus: (id, status) => api.put(`/tables/${id}/status`, { status }),
  
  // NEW: Add these CRUD methods
  create: (data) => api.post('/tables', data),
  update: (id, data) => api.put(`/tables/${id}`, data),
  delete: (id) => api.delete(`/tables/${id}`),
};

// Add these to your existing menuAPI object
export const menuAPI = {
  getAll: (params) => api.get('/menu', { params }),
  getCategories: () => api.get('/menu/categories'),
  getById: (id) => api.get(`/menu/${id}`),
  updateAvailability: (id, isAvailable) => 
    api.patch(`/menu/${id}/availability`, { isAvailable }),
  
  // NEW: Add these CRUD methods
  create: (data) => api.post('/menu', data),
  update: (id, data) => api.put(`/menu/${id}`, data),
  delete: (id) => api.delete(`/menu/${id}`),
};

export default api;