import axios from 'axios';

// ============================================
// API CONFIGURATION
// ============================================

// Determine base URLs based on environment
const isDev = import.meta.env.DEV;

export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (isDev 
    ? 'http://localhost:5000' 
    : window.location.origin);

export const API_URL = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/api`
  : (isDev 
      ? 'http://localhost:5000/api' 
      : `${window.location.origin}/api`);

console.log('🌐 API Configuration:');
console.log('   Environment:', isDev ? 'Development' : 'Production');
console.log('   API Base:', API_BASE_URL);
console.log('   API URL:', API_URL);

// ============================================
// AXIOS INSTANCE
// ============================================

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log requests in development
    if (isDev) {
      console.log(`📤 ${config.method.toUpperCase()} ${config.url}`);
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    if (isDev) {
      console.log(`✅ ${response.config.method.toUpperCase()} ${response.config.url}:`, response.status);
    }
    return response;
  },
  (error) => {
    console.error('❌ Response error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.response?.data?.message || error.message
    });

    // Handle authentication errors
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }

    return Promise.reject(error);
  }
);

// ============================================
// IMAGE URL HELPER
// ============================================

/**
 * Convert image path to full URL
 * @param {string} imagePath - Image path from database
 * @returns {string} Full image URL
 */
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // If already a full URL (Cloudinary URLs), return as-is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Local development path
  const path = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${API_BASE_URL}${path}`;
};

// ============================================
// API ENDPOINTS
// ============================================

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return Promise.resolve();
  },
  getCurrentUser: () => api.get('/auth/me'),
  refreshToken: () => api.post('/auth/refresh'),
};

// Tables API
export const tablesAPI = {
  getAll: () => api.get('/tables'),
  getById: (id) => api.get(`/tables/${id}`),
  getByNumber: (number) => api.get(`/tables/number/${number}`),
  create: (data) => api.post('/tables', data),
  update: (id, data) => api.put(`/tables/${id}`, data),
  delete: (id) => api.delete(`/tables/${id}`),
  updateStatus: (id, status) => api.patch(`/tables/${id}/status`, { status }),
  getQR: (tableNumber) => `${API_BASE_URL}/api/tables/${tableNumber}/qr`,
};

// Menu API
export const menuAPI = {
  getAll: (params) => api.get('/menu', { params }),
  getById: (id) => api.get(`/menu/${id}`),
  getCategories: () => api.get('/menu/categories'),
  create: (data) => api.post('/menu', data),
  update: (id, data) => api.put(`/menu/${id}`, data),
  delete: (id) => api.delete(`/menu/${id}`),
  updateAvailability: (id, isAvailable) => 
    api.patch(`/menu/${id}/availability`, { isAvailable }),
  
  // Image upload
  uploadImage: (formData) => {
    return api.post('/menu/upload-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  deleteImage: (imageUrl) => api.post('/menu/delete-image', { imageUrl }),
};

// Orders API
export const ordersAPI = {
  getAll: (params) => api.get('/orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  getByTable: (tableNumber) => api.get(`/orders/table/${tableNumber}`),
  create: (data) => api.post('/orders', data),
  update: (id, data) => api.put(`/orders/${id}`, data),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
  addItems: (id, items) => api.post(`/orders/${id}/items`, { items }),
  updateItem: (orderId, itemId, data) => 
    api.put(`/orders/${orderId}/items/${itemId}`, data),
  deleteItem: (orderId, itemId) => 
    api.delete(`/orders/${orderId}/items/${itemId}`),
  cancel: (id) => api.post(`/orders/${id}/cancel`),
};

// Bills API
export const billsAPI = {
  getAll: (params) => api.get('/bills', { params }),
  getById: (id) => api.get(`/bills/${id}`),
  generate: (orderId) => api.post('/bills/generate', { orderId }),
  settle: (id, paymentData) => api.post(`/bills/${id}/settle`, paymentData),
  print: (id) => api.get(`/bills/${id}/print`),
};

// Admin API
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getStats: (params) => api.get('/admin/stats', { params }),
  getReports: (params) => api.get('/admin/reports', { params }),
  exportData: (type, params) => api.get(`/admin/export/${type}`, { 
    params,
    responseType: 'blob'
  }),
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Handle API errors consistently
 * @param {Error} error - Axios error object
 * @returns {string} User-friendly error message
 */
export const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error
    return error.response.data?.message || 
           error.response.data?.error || 
           `Server error: ${error.response.status}`;
  } else if (error.request) {
    // Request made but no response
    return 'No response from server. Please check your connection.';
  } else {
    // Error setting up request
    return error.message || 'An unexpected error occurred';
  }
};

/**
 * Download file from blob response
 * @param {Blob} blob - File blob
 * @param {string} filename - Filename
 */
export const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Check if API is reachable
 * @returns {Promise<boolean>}
 */
export const checkApiHealth = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/health`, { 
      timeout: 5000 
    });
    return response.status === 200;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
};

// ============================================
// EXPORTS
// ============================================

export default api;

export {
  api,
  authAPI,
  tablesAPI,
  menuAPI,
  ordersAPI,
  billsAPI,
  adminAPI,
  handleApiError,
  downloadFile,
  checkApiHealth,
};