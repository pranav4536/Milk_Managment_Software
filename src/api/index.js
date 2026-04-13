import axios from 'axios';

const BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// ─── Vendors ────────────────────────────────────────────────────────────────
export const vendorsApi = {
  getAll: (skip = 0, limit = 100) =>
    api.get(`/vendors/?skip=${skip}&limit=${limit}`),
  getById: (id) => api.get(`/vendors/${id}`),
  create: (data) => api.post('/vendors/', data),
  update: (id, data) => api.put(`/vendors/${id}`, data),
  delete: (id) => api.delete(`/vendors/${id}`),
};

// ─── Milk Collection ────────────────────────────────────────────────────────
export const milkCollectionApi = {
  getAll: (skip = 0, limit = 100) =>
    api.get(`/milk-collection/?skip=${skip}&limit=${limit}`),
  getById: (id) => api.get(`/milk-collection/${id}`),
  getByVendor: (vendorId) => api.get(`/milk-collection/vendor/${vendorId}`),
  create: (data) => api.post('/milk-collection/', data),
  update: (id, data) => api.put(`/milk-collection/${id}`, data),
  delete: (id) => api.delete(`/milk-collection/${id}`),
};

// ─── Customers ──────────────────────────────────────────────────────────────
export const customersApi = {
  getAll: (skip = 0, limit = 100) =>
    api.get(`/customers/?skip=${skip}&limit=${limit}`),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers/', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
};

// ─── Deliveries ───────────────────────────────────────────────────────────────
export const deliveriesApi = {
  getAll: (skip = 0, limit = 100, customer_id = '', from_date = '', to_date = '') => {
    let url = `/deliveries/?skip=${skip}&limit=${limit}`;
    if (customer_id) url += `&customer_id=${customer_id}`;
    if (from_date) url += `&from_date=${from_date}`;
    if (to_date) url += `&to_date=${to_date}`;
    return api.get(url);
  },
  getById: (id) => api.get(`/deliveries/${id}`),
  getByCustomer: (customerId) => api.get(`/deliveries/customer/${customerId}`),
  create: (data) => api.post('/deliveries/', data),
  update: (id, data) => api.put(`/deliveries/${id}`, data),
  delete: (id) => api.delete(`/deliveries/${id}`),
};

// ─── Bottle Tracking ──────────────────────────────────────────────────────────
export const bottleTrackingApi = {
  getAll: (skip = 0, limit = 100) =>
    api.get(`/bottle-tracking/?skip=${skip}&limit=${limit}`),
  getSummary: () => api.get('/bottle-tracking/summary'),
  create: (data) => api.post('/bottle-tracking/', data),
  update: (id, data) => api.put(`/bottle-tracking/${id}`, data),
  delete: (id) => api.delete(`/bottle-tracking/${id}`),
};

// ─── Customer Transactions ──────────────────────────────────────────────────
export const customerTransactionsApi = {
  getAll: (skip = 0, limit = 100) =>
    api.get(`/customer-transactions/?skip=${skip}&limit=${limit}`),
  getById: (id) => api.get(`/customer-transactions/${id}`),
  getByCustomer: (customerId, status = '') => {
    let url = `/customer-transactions/customer/${customerId}`;
    if (status) url += `?status=${status}`;
    return api.get(url);
  },
  create: (data) => api.post('/customer-transactions/', data),
  update: (id, data) => api.put(`/customer-transactions/${id}`, data),
  delete: (id) => api.delete(`/customer-transactions/${id}`),
};

export default api;
