import axios from 'axios';

// API Configuration - Direct setup
const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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

// Tables API
export const tablesAPI = {
  getAll: () => api.get('/tables'),
  verify: (tableNumber) => api.post('/tables/verify', { tableNumber }),
  updateStatus: (id, status) => api.put(`/tables/${id}/status`, { status }),
};

// Menu API
export const menuAPI = {
  getAll: (params) => api.get('/menu', { params }),
  getCategories: () => api.get('/menu/categories'),
  getById: (id) => api.get(`/menu/${id}`),
  updateAvailability: (id, isAvailable) => 
    api.patch(`/menu/${id}/availability`, { isAvailable }),
};

// Orders API
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

// Bills API
export const billsAPI = {
  generate: (orderId) => api.post(`/bills/generate/${orderId}`),
  settle: (billId, paymentData) => api.post(`/bills/${billId}/settle`, paymentData),
  getById: (billId) => api.get(`/bills/${billId}`),
};

// Admin API
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getRevenueReport: (startDate, endDate) => 
    api.get('/admin/reports/revenue', { params: { startDate, endDate } }),
};

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
};

export default api;