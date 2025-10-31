import axios from 'axios';

// ===== API CONFIGURATION =====
// In production (Render): Use same domain (empty string means relative URLs)
// In development: Use localhost
const isDevelopment = import.meta.env.DEV;

const API_BASE_URL = isDevelopment 
  ? 'http://localhost:5000/api'  // Development
  : '/api';                       // Production (same domain)

console.log('🔧 API Mode:', isDevelopment ? 'Development' : 'Production');
console.log('🔗 API Base URL:', API_BASE_URL || 'Same domain (relative)');

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
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
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('❌ Response Error:', error.response?.status, error.message);
    
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// ===== TABLES API =====
export const tablesAPI = {
  getAll: () => api.get('/tables'),
  verify: (tableNumber) => api.post('/tables/verify', { tableNumber }),
  updateStatus: (id, status) => api.put(`/tables/${id}/status`, { status }),
};

// ===== MENU API =====
export const menuAPI = {
  getAll: (params) => api.get('/menu', { params }),
  getCategories: () => api.get('/menu/categories'),
  getById: (id) => api.get(`/menu/${id}`),
  updateAvailability: (id, isAvailable) => 
    api.patch(`/menu/${id}/availability`, { isAvailable }),
};

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

export default api;