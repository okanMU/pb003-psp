import { useState, useMemo } from 'react';

/**
 * Custom hook for payment filtering logic
 * Extracted from ManualCheckEnhanced component
 */
export const usePaymentFilters = () => {
  const [filters, setFilters] = useState({
    minAmount: '',
    maxAmount: '',
    customerEmail: '',
    customerPhone: '',
    riskLevel: 'ALL',
  });

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      minAmount: '',
      maxAmount: '',
      customerEmail: '',
      customerPhone: '',
      riskLevel: 'ALL',
    });
  };

  const applyFilters = (transactions) => {
    return transactions.filter((tx) => {
      // Amount filters
      if (filters.minAmount && tx.amount < parseFloat(filters.minAmount)) {
        return false;
      }
      if (filters.maxAmount && tx.amount > parseFloat(filters.maxAmount)) {
        return false;
      }

      // Email filter
      if (
        filters.customerEmail &&
        !tx.customerEmail?.toLowerCase().includes(filters.customerEmail.toLowerCase())
      ) {
        return false;
      }

      // Phone filter
      if (filters.customerPhone && !tx.customerPhone?.includes(filters.customerPhone)) {
        return false;
      }

      // Risk level filter
      if (filters.riskLevel !== 'ALL' && tx.riskLevel !== filters.riskLevel) {
        return false;
      }

      return true;
    });
  };

  const hasActiveFilters = useMemo(() => {
    return (
      filters.minAmount ||
      filters.maxAmount ||
      filters.customerEmail ||
      filters.customerPhone ||
      filters.riskLevel !== 'ALL'
    );
  }, [filters]);

  return {
    filters,
    updateFilter,
    resetFilters,
    applyFilters,
    hasActiveFilters,
  };
};
