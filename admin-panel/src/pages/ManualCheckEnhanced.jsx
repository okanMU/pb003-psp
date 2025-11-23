import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  Upload,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Keyboard,
  Filter,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { adminApi } from '../services/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/tr';
import FraudScoreCard, { calculateFraudScore, SmartApprovalActions } from '../components/FraudScoreCard';
import { usePaymentMutations } from '../hooks/usePaymentMutations';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { usePaymentFilters } from '../hooks/usePaymentFilters';

dayjs.extend(relativeTime);
dayjs.locale('tr');

/**
 * Enhanced Manual Check with keyboard shortcuts, mobile optimization
 */
export default function ManualCheckEnhanced() {
  const queryClient = useQueryClient();
  const [selectedBank, setSelectedBank] = useState(null);
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchCode, setSearchCode] = useState('');
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const transactionRefs = useRef([]);

  // Bekleyen ödemeleri çek
  const { data: checkList, isLoading, refetch } = useQuery({
    queryKey: ['pending-payments'],
    queryFn: () => adminApi.getPendingPayments().then((res) => res.data),
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Use custom hooks for filters
  const { filters, setFilters, filterTransactions } = usePaymentFilters();

  // Get filtered transactions
  const filteredTransactions = selectedBank?.transactions
    ? filterTransactions(selectedBank.transactions)
    : [];

  // Use custom hooks for mutations with navigation
  const handleSuccess = useCallback(() => {
    setSelectedTransactions([]);
    // Move to next transaction
    if (currentIndex < filteredTransactions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, filteredTransactions.length]);

  const {
    approve,
    reject,
    batchApprove,
    isApproving,
    isRejecting,
    isBatchApproving,
  } = usePaymentMutations({ onSuccess: handleSuccess });

  // Use custom keyboard shortcuts hook
  useKeyboardShortcuts({
    transactions: filteredTransactions,
    currentIndex,
    setCurrentIndex,
    onApprove: (tx) => approve(tx.id),
    onReject: (tx) => reject({ id: tx.id, reason: 'Manuel red (klavye kısayolu)' }),
    onToggleSelection: (tx) => {
      setSelectedTransactions((prev) => {
        const isSelected = prev.some((t) => t.id === tx.id);
        return isSelected ? prev.filter((t) => t.id !== tx.id) : [...prev, tx];
      });
    },
    onBatchApprove: () => {
      if (selectedTransactions.length > 0) {
        const approvals = selectedTransactions.map((tx) => ({
          id: tx.id,
          bankId: tx.bank_id,
        }));
        batchApprove(approvals);
      }
    },
    onShowHelp: () => setShowKeyboardHelp((prev) => !prev),
    isProcessing: isApproving || isRejecting,
  });

  // Scroll to current transaction
  useEffect(() => {
    if (transactionRefs.current[currentIndex]) {
      transactionRefs.current[currentIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentIndex]);

  // Get risk level (mock)
  const getRiskLevel = (tx) => {
    const score = Math.random() * 100;
    if (score < 25) return { level: 'low', color: 'green', label: 'Düşük Risk' };
    if (score < 50)
      return { level: 'medium', color: 'yellow', label: 'Orta Risk' };
    if (score < 75) return { level: 'high', color: 'orange', label: 'Yüksek Risk' };
    return { level: 'critical', color: 'red', label: 'Kritik Risk' };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Manuel Banka Kontrolü
          </h1>
          <p className="text-gray-600">
            Bekleyen ödemeleri kontrol et ve onayla
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Keyboard Help */}
          <button
            onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition"
          >
            <Keyboard className="w-4 h-4" />
            <span className="hidden sm:inline">Kısayollar</span>
          </button>

          {/* Auto Refresh */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              autoRefresh
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">
              {autoRefresh ? 'Otomatik' : 'Manuel'}
            </span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => refetch()}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            title="Yenile"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {/* Import */}
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Ekstre</span>
          </button>
        </div>
      </div>

      {/* Keyboard Help Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">⌨️ Klavye Kısayolları</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Onayla</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded border">Enter</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Reddet</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded border">R</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Sonraki İşlem</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded border">↓ / J</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Önceki İşlem</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded border">↑ / K</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Seç/Seçimi Kaldır</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded border">Space</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Toplu Onayla</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded border">Ctrl+A</kbd>
              </div>
            </div>
            <button
              onClick={() => setShowKeyboardHelp(false)}
              className="mt-6 w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Filtreler</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-600 block mb-1">Min Tutar</label>
            <input
              type="number"
              value={filters.minAmount}
              onChange={(e) =>
                setFilters({ ...filters, minAmount: e.target.value })
              }
              placeholder="0"
              className="w-full p-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Max Tutar</label>
            <input
              type="number"
              value={filters.maxAmount}
              onChange={(e) =>
                setFilters({ ...filters, maxAmount: e.target.value })
              }
              placeholder="999999"
              className="w-full p-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Risk Seviyesi</label>
            <select
              value={filters.riskLevel}
              onChange={(e) =>
                setFilters({ ...filters, riskLevel: e.target.value })
              }
              className="w-full p-2 border rounded-lg text-sm"
            >
              <option value="all">Tümü</option>
              <option value="low">Düşük</option>
              <option value="medium">Orta</option>
              <option value="high">Yüksek</option>
            </select>
          </div>
        </div>
      </div>

      {/* Smart Approval Actions */}
      {selectedBank && filteredTransactions.length > 0 && (
        <SmartApprovalActions
          transactions={filteredTransactions}
          onApprove={(id) => approve(id)}
          onReject={(id, reason) => reject({ id, reason })}
        />
      )}

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol: Banka Listesi */}
        <div className="space-y-3">
          <h3 className="font-semibold mb-3">
            Bankalar ({checkList?.length || 0})
          </h3>
          {checkList?.map((bank) => (
            <div
              key={bank.bankId}
              onClick={() => {
                setSelectedBank(bank);
                setCurrentIndex(0);
              }}
              className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                selectedBank?.bankId === bank.bankId
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{bank.bankName}</p>
                  <p className="text-xs text-gray-500 font-mono mt-1 truncate">
                    {bank.iban}
                  </p>
                </div>
                <ChevronRight
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    selectedBank?.bankId === bank.bankId ? 'rotate-90' : ''
                  }`}
                />
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between items-center">
                <div>
                  <p className="text-lg font-bold text-gray-900">
                    {bank.totalExpectedAmount.toLocaleString()} ₺
                  </p>
                  <p className="text-xs text-gray-600">
                    {bank.transactionCount} işlem
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Orta & Sağ: İşlem Listesi */}
        {selectedBank && (
          <div className="lg:col-span-2 space-y-4">
            {/* Stats & Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-3">
              <h3 className="font-semibold">
                İşlemler ({filteredTransactions.length})
              </h3>
              <div className="flex gap-2">
                {selectedTransactions.length > 0 && (
                  <button
                    onClick={() => {
                      const approvals = selectedTransactions.map((tx) => ({
                        id: tx.id,
                        bankId: tx.bank_id,
                      }));
                      batchApprove(approvals);
                    }}
                    disabled={isBatchApproving}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition flex items-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Seçilenleri Onayla ({selectedTransactions.length})
                  </button>
                )}
              </div>
            </div>

            {/* Transaction List */}
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {filteredTransactions.map((tx, index) => {
                const isSelected = selectedTransactions.find((t) => t.id === tx.id);
                const isCurrent = index === currentIndex;
                const risk = getRiskLevel(tx);

                return (
                  <div
                    key={tx.id}
                    ref={(el) => (transactionRefs.current[index] = el)}
                    className={`p-4 border-2 rounded-xl transition-all ${
                      isCurrent
                        ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                        : isSelected
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={!!isSelected}
                        onChange={() => {
                          setSelectedTransactions((prev) => {
                            const exists = prev.some((t) => t.id === tx.id);
                            return exists ? prev.filter((t) => t.id !== tx.id) : [...prev, tx];
                          });
                        }}
                        className="mt-1 w-5 h-5 cursor-pointer"
                      />

                      {/* Content */}
                      <div className="flex-1">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                          <div>
                            <p className="font-mono font-bold text-sm sm:text-base">
                              {tx.refCode}
                            </p>
                            <p className="text-xs text-gray-600">
                              {tx.customerEmail}
                            </p>
                            <p className="text-xs text-gray-500">
                              {tx.customerPhone}
                            </p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="font-bold text-lg sm:text-xl">
                              {tx.amount.toLocaleString()} ₺
                            </p>
                            <div className="flex items-center gap-1 text-xs text-orange-600 mt-1">
                              <Clock className="w-3 h-3" />
                              {tx.remainingMinutes} dk kaldı
                            </div>
                          </div>
                        </div>

                        {/* Fraud Score */}
                        <div className="mb-3">
                          <FraudScoreCard transaction={tx} compact={true} />
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => approve(tx.id)}
                            disabled={isApproving}
                            className="flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Onayla
                          </button>
                          <button
                            onClick={() =>
                              reject({
                                id: tx.id,
                                reason: 'Manuel red',
                              })
                            }
                            disabled={isRejecting}
                            className="flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <XCircle className="w-4 h-4" />
                            Reddet
                          </button>
                        </div>

                        {/* Current indicator */}
                        {isCurrent && (
                          <div className="mt-3 pt-3 border-t border-blue-200">
                            <p className="text-xs text-blue-600 font-semibold flex items-center gap-1">
                              <ArrowDown className="w-3 h-3 animate-bounce" />
                              Şu anda seçili (Enter = Onayla, R = Reddet)
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
