import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Key,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  Send,
  Activity,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Download,
  Settings,
  Webhook,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

/**
 * Platform Dashboard for Integration Partners
 * Manage API keys, view transactions, test webhooks, see analytics
 */
export default function PlatformDashboard() {
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [testPayload, setTestPayload] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('7d');

  // Mock platform data (would come from backend)
  const platformData = {
    id: 'platform_123',
    name: 'Örnek E-ticaret',
    apiKey: 'pk_live_1234567890abcdefghijklmnopqrstuvwxyz',
    webhookUrl: 'https://example.com/webhooks/pspay',
    stats: {
      totalVolume: 1250000,
      totalCount: 342,
      successRate: 94.5,
      avgProcessingTime: 2.3, // minutes
      commission: 12500,
    },
  };

  // Mock transaction data
  const transactions = Array.from({ length: 20 }, (_, i) => ({
    id: `tx_${i}`,
    code: `PAY${(100000 + i).toString()}`,
    amount: Math.floor(Math.random() * 50000) + 1000,
    status: ['APPROVED', 'PENDING', 'REJECTED', 'EXPIRED'][
      Math.floor(Math.random() * 4)
    ],
    customerEmail: `musteri${i}@example.com`,
    createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
  }));

  // Mock hourly data
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, '0')}:00`,
    volume: Math.floor(Math.random() * 30000) + 5000,
    count: Math.floor(Math.random() * 20) + 5,
  }));

  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Kopyalandı!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Test webhook
  const handleTestWebhook = () => {
    if (!webhookUrl) {
      toast.error('Webhook URL giriniz');
      return;
    }

    toast.loading('Webhook gönderiliyor...', { duration: 2000 });
    setTimeout(() => {
      toast.success('Test webhook başarıyla gönderildi!');
    }, 2000);
  };

  // Status badge
  const StatusBadge = ({ status }) => {
    const styles = {
      APPROVED: 'bg-green-100 text-green-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      REJECTED: 'bg-red-100 text-red-800',
      EXPIRED: 'bg-gray-100 text-gray-800',
    };

    const labels = {
      APPROVED: 'Onaylandı',
      PENDING: 'Bekliyor',
      REJECTED: 'Reddedildi',
      EXPIRED: 'Süresi Doldu',
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-semibold ${
          styles[status] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Platform Dashboard
          </h1>
          <p className="text-gray-600">{platformData.name}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition">
          <Settings className="w-4 h-4" />
          Ayarlar
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Toplam Hacim</p>
            <DollarSign className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {platformData.stats.totalVolume.toLocaleString()} ₺
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {platformData.stats.totalCount} işlem
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Başarı Oranı</p>
            <CheckCircle2 className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {platformData.stats.successRate}%
          </p>
          <p className="text-sm text-gray-500 mt-1">Son 7 gün</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Ortalama İşlem Süresi</p>
            <Clock className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {platformData.stats.avgProcessingTime} dk
          </p>
          <p className="text-sm text-gray-500 mt-1">Ortalama</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Toplam Komisyon</p>
            <TrendingUp className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {platformData.stats.commission.toLocaleString()} ₺
          </p>
          <p className="text-sm text-gray-500 mt-1">Platform komisyonu</p>
        </div>
      </div>

      {/* API Key Management */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            API Key Yönetimi
          </h2>
        </div>

        <div className="space-y-4">
          {/* API Key Display */}
          <div>
            <label className="text-sm text-gray-600 block mb-2">
              API Anahtarı (API Key)
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={apiKeyVisible ? 'text' : 'password'}
                  value={platformData.apiKey}
                  readOnly
                  className="w-full p-3 pr-12 border rounded-lg font-mono text-sm bg-gray-50"
                />
                <button
                  onClick={() => setApiKeyVisible(!apiKeyVisible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {apiKeyVisible ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              <button
                onClick={() => copyToClipboard(platformData.apiKey)}
                className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
              >
                {copied ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
              <button className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Yenile
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ⚠️ API anahtarınızı kimseyle paylaşmayın. Bu anahtar tüm API
              işlemlerinizi yetkilendirir.
            </p>
          </div>

          {/* Webhook URL */}
          <div>
            <label className="text-sm text-gray-600 block mb-2">
              Webhook URL
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={webhookUrl || platformData.webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-domain.com/webhooks/pspay"
                className="flex-1 p-3 border rounded-lg"
              />
              <button className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                Kaydet
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Volume Chart */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            İşlem Hacmi (Son 24 Saat)
          </h2>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={hourlyData}>
            <defs>
              <linearGradient id="colorVolume2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="hour" tick={{ fontSize: 12 }} tickLine={false} />
            <YAxis tick={{ fontSize: 12 }} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
              formatter={(value) => [`${value.toLocaleString()} ₺`, 'Hacim']}
            />
            <Area
              type="monotone"
              dataKey="volume"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#colorVolume2)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Webhook Tester */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <Webhook className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Webhook Test Aracı
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 block mb-2">
              Test URL
            </label>
            <input
              type="text"
              value={webhookUrl || platformData.webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-domain.com/webhooks/test"
              className="w-full p-3 border rounded-lg"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 block mb-2">
              Test Payload (JSON)
            </label>
            <textarea
              value={
                testPayload ||
                JSON.stringify(
                  {
                    event: 'payment.approved',
                    data: {
                      id: 'pay_123456',
                      amount: 15000,
                      status: 'APPROVED',
                      reference_code: 'PAY123456',
                    },
                  },
                  null,
                  2
                )
              }
              onChange={(e) => setTestPayload(e.target.value)}
              rows={8}
              className="w-full p-3 border rounded-lg font-mono text-sm"
            />
          </div>

          <button
            onClick={handleTestWebhook}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 font-semibold"
          >
            <Send className="w-5 h-5" />
            Test Webhook Gönder
          </button>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              💡 <strong>İpucu:</strong> Webhook'unuzun düzgün çalıştığından
              emin olmak için test gönderin. Başarılı bir webhook 200 OK yanıtı
              vermelidir.
            </p>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-gray-600" />
                İşlem Geçmişi
              </h2>
            </div>

            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ref kod ara..."
                  className="pl-10 pr-4 py-2 border rounded-lg text-sm w-full sm:w-64"
                />
              </div>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 border rounded-lg text-sm"
              >
                <option value="1d">Bugün</option>
                <option value="7d">Son 7 Gün</option>
                <option value="30d">Son 30 Gün</option>
                <option value="all">Tümü</option>
              </select>
              <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm flex items-center gap-2">
                <Download className="w-4 h-4" />
                Dışa Aktar
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Ref Kod
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tutar
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Müşteri
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Durum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tarih
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transactions
                .filter(
                  (tx) =>
                    !searchQuery ||
                    tx.code.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .slice(0, 10)
                .map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-gray-50 transition cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <code className="font-mono font-semibold text-sm text-gray-900">
                        {tx.code}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-900">
                        {tx.amount.toLocaleString()} ₺
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {tx.customerEmail}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={tx.status} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {dayjs(tx.createdAt).format('DD.MM.YYYY HH:mm')}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
