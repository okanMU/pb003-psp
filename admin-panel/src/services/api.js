import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Admin API
export const adminApi = {
  // Dashboard
  getDashboardStats: () => api.get('/admin/dashboard/stats'),

  // Payments
  getPendingPayments: () => api.get('/admin/payments/pending'),
  approvePayment: (id) =>
    api.post(`/admin/payments/${id}/approve`), // adminId now comes from JWT token
  rejectPayment: (id, reason) =>
    api.post(`/admin/payments/${id}/reject`, { reason }), // adminId now comes from JWT token
  batchApprove: (approvals) =>
    api.post('/admin/payments/batch-approve', { approvals }), // adminId added on backend from JWT

  // Search
  searchByRefCode: (code) => api.get(`/admin/search/ref-code/${code}`),
};

export default api;
