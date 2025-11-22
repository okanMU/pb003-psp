import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  Upload,
  Search,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { adminApi } from '../services/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/tr';

dayjs.extend(relativeTime);
dayjs.locale('tr');

export default function ManualCheck() {
  const queryClient = useQueryClient();
  const [selectedBank, setSelectedBank] = useState(null);
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchCode, setSearchCode] = useState('');

  // Bekleyen ödemeleri çek
  const { data: checkList, isLoading, refetch } = useQuery({
    queryKey: ['pending-payments'],
    queryFn: () => adminApi.getPendingPayments().then((res) => res.data),
    refetchInterval: autoRefresh ? 30000 : false, // 30 saniye
  });

  // Onaylama mutation
  const approveMutation = useMutation({
    mutationFn: (id) => adminApi.approvePayment(id, 'admin-user-id'),
    onSuccess: () => {
      toast.success('Ödeme onaylandı');
      queryClient.invalidateQueries(['pending-payments']);
      setSelectedTransactions([]);
    },
    onError: () => {
      toast.error('Onaylama başarısız');
    },
  });

  // Reddetme mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) =>
      adminApi.rejectPayment(id, 'admin-user-id', reason),
    onSuccess: () => {
      toast.success('Ödeme reddedildi');
      queryClient.invalidateQueries(['pending-payments']);
      setSelectedTransactions([]);
    },
    onError: () => {
      toast.error('Reddetme başarısız');
    },
  });

  // Toplu onaylama
  const batchApproveMutation = useMutation({
    mutationFn: (approvals) => adminApi.batchApprove(approvals),
    onSuccess: () => {
      toast.success('Toplu onaylama tamamlandı');
      queryClient.invalidateQueries(['pending-payments']);
      setSelectedTransactions([]);
    },
    onError: () => {
      toast.error('Toplu onaylama başarısız');
    },
  });

  const handleBatchApprove = () => {
    const approvals = selectedTransactions.map((tx) => ({
      refCode: tx.refCode,
      adminId: 'admin-user-id',
    }));

    batchApproveMutation.mutate(approvals);
  };

  const handleToggleTransaction = (tx) => {
    const exists = selectedTransactions.find((t) => t.id === tx.id);
    if (exists) {
      setSelectedTransactions(selectedTransactions.filter((t) => t.id !== tx.id));
    } else {
      setSelectedTransactions([...selectedTransactions, tx]);
    }
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manuel Banka Kontrolü</h1>
          <p className="text-gray-600">Bekleyen ödemeleri kontrol et ve onayla</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              autoRefresh
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            <RefreshCw
              className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`}
            />
            {autoRefresh ? 'Otomatik Yenileme Açık' : 'Otomatik Yenileme Kapalı'}
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => refetch()}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {/* Import (Mock) */}
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Upload className="w-4 h-4" />
            Ekstre Yükle
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol: Banka Listesi */}
        <div className="space-y-3">
          <h3 className="font-semibold mb-3">Bankalar</h3>
          {checkList?.map((bank) => (
            <div
              key={bank.bankId}
              onClick={() => setSelectedBank(bank)}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                selectedBank?.bankId === bank.bankId
                  ? 'border-blue-500 bg-blue-50'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{bank.bankName}</p>
                  <p className="text-xs text-gray-500 font-mono mt-1">
                    {bank.iban}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">
                    {bank.totalExpectedAmount.toLocaleString()} TRY
                  </p>
                  <p className="text-sm text-gray-600">
                    {bank.transactionCount} işlem
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Orta: İşlem Listesi */}
        {selectedBank && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Bekleyen İşlemler</h3>
              <button
                onClick={handleBatchApprove}
                disabled={selectedTransactions.length === 0}
                className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-700"
              >
                Seçilenleri Onayla ({selectedTransactions.length})
              </button>
            </div>

            {selectedBank.transactions.map((tx) => {
              const isSelected = selectedTransactions.find((t) => t.id === tx.id);

              return (
                <div
                  key={tx.id}
                  className={`p-3 border rounded-lg ${
                    isSelected ? 'border-green-500 bg-green-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={!!isSelected}
                      onChange={() => handleToggleTransaction(tx)}
                      className="mt-1"
                    />

                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-mono font-bold text-sm">
                            {tx.refCode}
                          </p>
                          <p className="text-xs text-gray-600">
                            {tx.customerEmail}
                          </p>
                          <p className="text-xs text-gray-500">
                            {tx.customerPhone}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">
                            {tx.amount.toLocaleString()} TRY
                          </p>
                          <div className="flex items-center gap-1 text-xs text-orange-600">
                            <Clock className="w-3 h-3" />
                            {tx.remainingMinutes} dk kaldı
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => approveMutation.mutate(tx.id)}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          Onayla
                        </button>
                        <button
                          onClick={() =>
                            rejectMutation.mutate({
                              id: tx.id,
                              reason: 'Manuel red',
                            })
                          }
                          className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                        >
                          Reddet
                        </button>
                        <button className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700">
                          Detay
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sağ: Yardımcı Panel */}
        <div className="space-y-4">
          {/* Hızlı Arama */}
          <div className="border rounded-lg p-4 bg-white">
            <h3 className="font-semibold mb-3">Hızlı Ref Kod Arama</h3>

            <div className="flex gap-2">
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                placeholder="PAY123456"
                className="flex-1 p-2 border rounded-lg"
              />
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* İstatistikler */}
          <div className="border rounded-lg p-4 bg-white">
            <h3 className="font-semibold mb-3">Bugünkü İstatistikler</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Onaylanan:</span>
                <span className="font-bold text-green-600">-</span>
              </div>
              <div className="flex justify-between">
                <span>Reddedilen:</span>
                <span className="font-bold text-red-600">-</span>
              </div>
              <div className="flex justify-between">
                <span>Bekleyen:</span>
                <span className="font-bold text-yellow-600">
                  {checkList?.reduce((sum, b) => sum + b.transactionCount, 0) || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
