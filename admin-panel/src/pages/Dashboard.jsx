import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  Clock,
  CheckCircle,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { adminApi } from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';

export default function Dashboard() {
  const { stats: wsStats, connected } = useWebSocket();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => adminApi.getDashboardStats().then((res) => res.data),
    refetchInterval: connected ? false : 30000, // WebSocket varsa otomatik yenileme yapma
  });

  // WebSocket'ten gelen stats varsa onu kullan
  const currentStats = wsStats || stats;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Günlük Hacim',
      value: `${currentStats?.todayVolume?.toLocaleString() || 0} TRY`,
      subValue: `${currentStats?.todayCount || 0} işlem`,
      icon: DollarSign,
      color: 'bg-green-500',
      trend: '+12.5%',
      trendUp: true,
    },
    {
      label: 'Bekleyen',
      value: currentStats?.pendingCount || 0,
      subValue: `${currentStats?.pendingAmount?.toLocaleString() || 0} TRY`,
      icon: Clock,
      color: 'bg-yellow-500',
    },
    {
      label: 'Başarı Oranı',
      value: `${currentStats?.successRate || 0}%`,
      subValue: 'Bugün',
      icon: CheckCircle,
      color: 'bg-blue-500',
      trend: '+2.3%',
      trendUp: true,
    },
    {
      label: 'Komisyon Geliri',
      value: `${currentStats?.commissionEarned?.toLocaleString() || 0} TRY`,
      subValue: 'Bugün',
      icon: TrendingUp,
      color: 'bg-purple-500',
      trend: '+8.1%',
      trendUp: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">PSP Yönetim Paneli</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">{stat.subValue}</p>

                  {stat.trend && (
                    <div className="mt-2 flex items-center gap-1">
                      {stat.trendUp ? (
                        <ArrowUpRight className="w-4 h-4 text-green-500" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-red-500" />
                      )}
                      <span
                        className={`text-sm font-medium ${
                          stat.trendUp ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {stat.trend}
                      </span>
                      <span className="text-sm text-gray-500">vs dün</span>
                    </div>
                  )}
                </div>

                <div
                  className={`${stat.color} rounded-lg p-3 text-white`}
                >
                  <Icon className="w-8 h-8" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button className="p-6 bg-blue-50 rounded-lg hover:bg-blue-100 transition text-left">
          <h3 className="font-semibold text-blue-900 mb-2">Manuel Kontrol</h3>
          <p className="text-sm text-blue-700">
            Bekleyen ödemeleri kontrol et
          </p>
        </button>

        <button className="p-6 bg-green-50 rounded-lg hover:bg-green-100 transition text-left">
          <h3 className="font-semibold text-green-900 mb-2">Raporlar</h3>
          <p className="text-sm text-green-700">
            Detaylı raporları görüntüle
          </p>
        </button>

        <button className="p-6 bg-purple-50 rounded-lg hover:bg-purple-100 transition text-left">
          <h3 className="font-semibold text-purple-900 mb-2">Ayarlar</h3>
          <p className="text-sm text-purple-700">
            Banka ve komisyon ayarları
          </p>
        </button>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Son Aktiviteler</h2>
        </div>
        <div className="p-6">
          <p className="text-gray-500 text-center py-8">
            Real-time aktiviteler burada görünecek
          </p>
        </div>
      </div>
    </div>
  );
}
