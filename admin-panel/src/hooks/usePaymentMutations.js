import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { adminApi } from '../services/api';

/**
 * Custom hook for payment mutation operations
 * Handles approve, reject, and batch approve operations
 */
export const usePaymentMutations = ({ onSuccess } = {}) => {
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: (id) => adminApi.approvePayment(id),
    onSuccess: () => {
      toast.success('✅ Payment approved');
      queryClient.invalidateQueries(['pending-payments']);
      onSuccess?.('approve');
    },
    onError: (error) => {
      toast.error(`❌ Approval failed: ${error.message || 'Unknown error'}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => adminApi.rejectPayment(id, reason),
    onSuccess: () => {
      toast.success('❌ Payment rejected');
      queryClient.invalidateQueries(['pending-payments']);
      onSuccess?.('reject');
    },
    onError: (error) => {
      toast.error(`❌ Rejection failed: ${error.message || 'Unknown error'}`);
    },
  });

  const batchApproveMutation = useMutation({
    mutationFn: (approvals) => adminApi.batchApprove(approvals),
    onSuccess: (data) => {
      const count = data?.approved?.length || 0;
      toast.success(`✅ Batch approval completed: ${count} transaction(s)`);
      queryClient.invalidateQueries(['pending-payments']);
      onSuccess?.('batch');
    },
    onError: (error) => {
      toast.error(`❌ Batch approval failed: ${error.message || 'Unknown error'}`);
    },
  });

  const approve = (id) => {
    if (!approveMutation.isPending) {
      approveMutation.mutate(id);
    }
  };

  const reject = (id, reason = 'Manual rejection') => {
    if (!rejectMutation.isPending) {
      rejectMutation.mutate({ id, reason });
    }
  };

  const batchApprove = (approvals) => {
    if (!batchApproveMutation.isPending && approvals.length > 0) {
      batchApproveMutation.mutate(approvals);
    }
  };

  return {
    approve,
    reject,
    batchApprove,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isBatchApproving: batchApproveMutation.isPending,
    isAnyPending:
      approveMutation.isPending ||
      rejectMutation.isPending ||
      batchApproveMutation.isPending,
  };
};
