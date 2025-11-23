import { useState } from 'react';
import {
  TrendingUp,
  Clock,
  DollarSign,
  Users,
  Activity,
  Calendar,
  Download,
  Filter,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

/**
 * Advanced Analytics Dashboard with Heatmaps and Detailed Metrics
 */
export default function AdvancedAnalytics() {
  const [dateRange, setDateRange] = useState('30d');
  const [metric, setMetric] = useState('volume');

  // Hourly heatmap data (24h x 7 days)
  const generateHeatmapData = () => {
    const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    const data = [];

    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        // Mock intensity (higher during business hours)
        let intensity = Math.random() * 30;
        if (hour >= 9 && hour <= 18 && day < 5) {
          intensity += 50; // Business hours
        }
        if (hour >= 20 || hour <= 6) {
          intensity = Math.random() * 10; // Night hours
        }

        data.push({
          day,
          dayName: days[day],
          hour,
          intensity: Math.floor(intensity),
          transactions: Math.floor((intensity / 100) * 50),
        });
      }
    }
    return data;
  };

  const heatmapData = generateHeatmapData();

  // Bank performance data
  const bankPerformance = [
    { name: 'Ziraat Bankası', volume: 450000, count: 123, success: 96.5 },
    { name: 'İş Bankası', volume: 380000, count: 98, success: 94.2 },
    { name: 'Garanti BBVA', volume: 320000, count: 87, success: 95.8 },
    { name: 'Yapı Kredi', volume: 280000, count: 76, success: 93.1 },
    { name: 'Akbank', volume: 250000, count: 65, success: 97.3 },
  ];

  // Fraud rate tracking
  const fraudData = Array.from({ length: 30 }, (_, i) => ({
    date: `${i + 1} Ocak`,
    blocked: Math.floor(Math.random() * 10),
    flagged: Math.floor(Math.random() * 20) + 5,
    safe: Math.floor(Math.random() * 100) + 50,
  }));

  // Commission breakdown
  const commissionData = [
    { name: 'Platform Komisyonu', value: 45000, color: '#3b82f6' },
    { name: 'PSP Komisyonu', value: 35000, color: '#8b5cf6' },
    { name: 'Banka Kesintisi', value: 20000, color: '#ef4444' },
  ];

  // Get heatmap color
  const getHeatmapColor = (intensity) => {
    if (intensity < 20) return '#f0f9ff'; // Very light blue
    if (intensity < 40) return '#bfdbfe';
    if (intensity < 60) return '#60a5fa';
    if (intensity < 80) return '#3b82f6';
    return '#1e40af'; // Dark blue
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Gelişmiş Analizler
          </h1>
          <p className="text-gray-600">
            Detaylı metrikler, heatmap ve performans raporları
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="7d">Son 7 Gün</option>
            <option value="30d">Son 30 Gün</option>
            <option value="90d">Son 3 Ay</option>
            <option value="1y">Son 1 Yıl</option>
          </select>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
            <Download className="w-4 h-4" />
            Rapor İndir
          </button>
        </div>
      </div>

      {/* Heatmap - Transaction Volume by Hour */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600" />
              İşlem Yoğunluğu Haritası
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Saate ve güne göre işlem dağılımı
            </p>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="flex gap-2 mb-2">
              <div className="w-16"></div>
              {Array.from({ length: 24 }, (_, i) => (
                <div
                  key={i}
                  className="w-8 text-center text-xs text-gray-600"
                >
                  {i}
                </div>
              ))}
            </div>

            {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(
              (day, dayIndex) => (
                <div key={day} className="flex gap-2 mb-2">
                  <div className="w-16 text-sm text-gray-700 font-medium flex items-center">
                    {day}
                  </div>
                  {heatmapData
                    .filter((d) => d.day === dayIndex)
                    .map((cell) => (
                      <div
                        key={`${cell.day}-${cell.hour}`}
                        className="w-8 h-8 rounded cursor-pointer hover:ring-2 hover:ring-blue-500 transition relative group"
                        style={{
                          backgroundColor: getHeatmapColor(cell.intensity),
                        }}
                        title={`${cell.dayName} ${cell.hour}:00 - ${cell.transactions} işlem`}
                      >
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                          <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                            {cell.dayName} {cell.hour}:00
                            <br />
                            {cell.transactions} işlem
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4">
              <span className="text-sm text-gray-600">Düşük</span>
              <div className="flex gap-1">
                {[20, 40, 60, 80, 100].map((intensity) => (
                  <div
                    key={intensity}
                    className="w-6 h-6 rounded"
                    style={{ backgroundColor: getHeatmapColor(intensity) }}
                  ></div>
                ))}
              </div>
              <span className="text-sm text-gray-600">Yüksek</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bank Performance Comparison */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-600" />
          Banka Performans Karşılaştırması
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Banka
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">
                  Hacim
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">
                  İşlem
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500">
                  Başarı Oranı
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  Performans
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bankPerformance.map((bank, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-4 font-semibold text-gray-900">
                    {bank.name}
                  </td>
                  <td className="px-4 py-4 text-right font-semibold">
                    {bank.volume.toLocaleString()} ₺
                  </td>
                  <td className="px-4 py-4 text-right text-gray-600">
                    {bank.count}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span
                      className={`font-semibold ${
                        bank.success >= 95
                          ? 'text-green-600'
                          : 'text-yellow-600'
                      }`}
                    >
                      {bank.success}%
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${bank.success}%` }}
                      ></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fraud Detection Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-600" />
            Fraud Tespit Trendi
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={fraudData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="blocked"
                stackId="1"
                stroke="#ef4444"
                fill="#ef4444"
                name="Engellendi"
              />
              <Area
                type="monotone"
                dataKey="flagged"
                stackId="1"
                stroke="#f59e0b"
                fill="#f59e0b"
                name="Şüpheli"
              />
              <Area
                type="monotone"
                dataKey="safe"
                stackId="1"
                stroke="#10b981"
                fill="#10b981"
                name="Güvenli"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-purple-600" />
            Komisyon Dağılımı
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={commissionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name} (${(percent * 100).toFixed(0)}%)`
                }
                outerRadius={80}
                dataKey="value"
              >
                {commissionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {commissionData.map((item) => (
              <div key={item.name} className="flex justify-between text-sm">
                <span className="text-gray-600">{item.name}</span>
                <span className="font-semibold">
                  {item.value.toLocaleString()} ₺
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border-2 border-blue-200">
          <Clock className="w-8 h-8 text-blue-600 mb-3" />
          <h3 className="font-semibold text-blue-900 mb-2">
            En Yoğun Saat
          </h3>
          <p className="text-3xl font-bold text-blue-700 mb-1">14:00-16:00</p>
          <p className="text-sm text-blue-600">İşlemlerin %35'i</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border-2 border-green-200">
          <Users className="w-8 h-8 text-green-600 mb-3" />
          <h3 className="font-semibold text-green-900 mb-2">
            Ortalama İşlem Değeri
          </h3>
          <p className="text-3xl font-bold text-green-700 mb-1">3,650 ₺</p>
          <p className="text-sm text-green-600">Geçen aya göre +12%</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border-2 border-purple-200">
          <TrendingUp className="w-8 h-8 text-purple-600 mb-3" />
          <h3 className="font-semibold text-purple-900 mb-2">
            En İyi Banka
          </h3>
          <p className="text-lg font-bold text-purple-700 mb-1">
            {bankPerformance[0].name}
          </p>
          <p className="text-sm text-purple-600">
            {bankPerformance[0].success}% başarı
          </p>
        </div>
      </div>
    </div>
  );
}
