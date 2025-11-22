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
  approvePayment: (id, adminId) =>
    api.post(`/admin/payments/${id}/approve`, { adminId }),
  rejectPayment: (id, adminId, reason) =>
    api.post(`/admin/payments/${id}/reject`, { adminId, reason }),
  batchApprove: (approvals) =>
    api.post('/admin/payments/batch-approve', { approvals }),

  // Search
  searchByRefCode: (code) => api.get(`/admin/search/ref-code/${code}`),
};

export default api;
