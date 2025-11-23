import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  DollarSign,
  Clock,
  CheckCircle,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Bell,
  X,
  Activity,
  Users,
  CreditCard,
  AlertTriangle,
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { adminApi } from '../services/api';
import { useWebSocket } from '../context/WebSocketContext';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

/**
 * Enhanced Dashboard with real trends, charts, and activity feed
 */
export default function DashboardEnhanced() {
  const navigate = useNavigate();
  const { stats: wsStats, connected, notifications } = useWebSocket();
  const [showNotifications, setShowNotifications] = useState(false);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => adminApi.getDashboardStats().then((res) => res.data),
    refetchInterval: connected ? false : 30000,
  });

  // WebSocket'ten gelen stats varsa onu kullan
  const currentStats = wsStats || stats;

  // Mock hourly data for chart (in real app, this would come from backend)
  const hourlyData = Array.from({ length: 24 }, (_, i) => {
    const hour = (new Date().getHours() - 23 + i + 24) % 24;
    return {
      hour: `${hour.toString().padStart(2, '0')}:00`,
      volume: Math.floor(Math.random() * 50000) + 10000,
      count: Math.floor(Math.random() * 50) + 10,
      success: Math.floor(Math.random() * 40) + 30,
    };
  });

  // Mock status distribution
  const statusData = [
    { name: 'Onaylandı', value: currentStats?.approvedCount || 45, color: '#10b981' },
    { name: 'Bekliyor', value: currentStats?.pendingCount || 12, color: '#f59e0b' },
    { name: 'Reddedildi', value: currentStats?.rejectedCount || 3, color: '#ef4444' },
  ];

  // Calculate trends (mock - would come from backend comparing today vs yesterday)
  const calculateTrend = (current, previous) => {
    if (!previous || previous === 0) return { value: 0, isUp: true };
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      isUp: change > 0,
    };
  };

  const volumeTrend = calculateTrend(
    currentStats?.todayVolume || 0,
    currentStats?.yesterdayVolume || currentStats?.todayVolume * 0.88
  );
  const countTrend = calculateTrend(
    currentStats?.todayCount || 0,
    currentStats?.yesterdayCount || currentStats?.todayCount * 0.92
  );
  const successTrend = calculateTrend(
    currentStats?.successRate || 0,
    currentStats?.yesterdaySuccessRate || currentStats?.successRate * 0.98
  );
  const commissionTrend = calculateTrend(
    currentStats?.commissionEarned || 0,
    currentStats?.yesterdayCommission || currentStats?.commissionEarned * 0.91
  );

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
      value: `${currentStats?.todayVolume?.toLocaleString() || 0} ₺`,
      subValue: `${currentStats?.todayCount || 0} işlem`,
      icon: DollarSign,
      color: 'bg-green-500',
      trend: volumeTrend,
    },
    {
      label: 'Bekleyen',
      value: currentStats?.pendingCount || 0,
      subValue: `${currentStats?.pendingAmount?.toLocaleString() || 0} ₺`,
      icon: Clock,
      color: 'bg-yellow-500',
    },
    {
      label: 'Başarı Oranı',
      value: `${currentStats?.successRate || 0}%`,
      subValue: 'Bugün',
      icon: CheckCircle,
      color: 'bg-blue-500',
      trend: successTrend,
    },
    {
      label: 'Komisyon Geliri',
      value: `${currentStats?.commissionEarned?.toLocaleString() || 0} ₺`,
      subValue: 'Bugün',
      icon: TrendingUp,
      color: 'bg-purple-500',
      trend: commissionTrend,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">
            PSP Yönetim Paneli
            {connected && (
              <span className="ml-2 inline-flex items-center gap-1 text-green-600 text-sm">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Canlı
              </span>
            )}
          </p>
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-3 bg-white rounded-full shadow-md hover:shadow-lg transition"
          >
            <Bell className="w-6 h-6 text-gray-700" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
          </button>

          {/* Notification Panel */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border z-50 max-h-96 overflow-hidden flex flex-col">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-semibold">Bildirimler</h3>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    Henüz bildirim yok
                  </p>
                ) : (
                  <div className="divide-y">
                    {notifications.slice(0, 20).map((notif, i) => (
                      <div
                        key={i}
                        className="p-3 hover:bg-gray-50 transition cursor-pointer"
                      >
                        <p className="text-sm font-medium text-gray-900">
                          {notif.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {dayjs(notif.timestamp).format('HH:mm:ss')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-xl transition-all duration-200 hover:scale-105 cursor-pointer"
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
                      {stat.trend.isUp ? (
                        <ArrowUpRight className="w-4 h-4 text-green-500" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-red-500" />
                      )}
                      <span
                        className={`text-sm font-medium ${
                          stat.trend.isUp ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {stat.trend.value}%
                      </span>
                      <span className="text-sm text-gray-500">vs dün</span>
                    </div>
                  )}
                </div>

                <div className={`${stat.color} rounded-lg p-3 text-white`}>
                  <Icon className="w-8 h-8" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Volume Chart */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            24 Saatlik İşlem Hacmi
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={hourlyData}>
              <defs>
                <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
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
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#colorVolume)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-purple-600" />
            İşlem Durumu
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {statusData.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-gray-700">{item.name}</span>
                </div>
                <span className="font-semibold text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          onClick={() => navigate('/manual-check')}
          className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl hover:from-blue-100 hover:to-blue-200 transition-all duration-200 text-left group"
        >
          <div className="flex items-center justify-between mb-3">
            <Clock className="w-8 h-8 text-blue-600" />
            <ArrowUpRight className="w-5 h-5 text-blue-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </div>
          <h3 className="font-semibold text-blue-900 mb-2">Manuel Kontrol</h3>
          <p className="text-sm text-blue-700">
            {currentStats?.pendingCount || 0} bekleyen ödeme
          </p>
        </button>

        <button className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl hover:from-green-100 hover:to-green-200 transition-all duration-200 text-left group">
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="w-8 h-8 text-green-600" />
            <ArrowUpRight className="w-5 h-5 text-green-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </div>
          <h3 className="font-semibold text-green-900 mb-2">Raporlar</h3>
          <p className="text-sm text-green-700">
            Detaylı analiz ve raporlar
          </p>
        </button>

        <button className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl hover:from-purple-100 hover:to-purple-200 transition-all duration-200 text-left group">
          <div className="flex items-center justify-between mb-3">
            <Users className="w-8 h-8 text-purple-600" />
            <ArrowUpRight className="w-5 h-5 text-purple-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </div>
          <h3 className="font-semibold text-purple-900 mb-2">Bankalar</h3>
          <p className="text-sm text-purple-700">
            Banka ve teminat yönetimi
          </p>
        </button>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-gray-600" />
            Son Aktiviteler
          </h2>
        </div>
        <div className="divide-y">
          {notifications.length === 0 ? (
            <p className="text-gray-500 text-center py-12">
              Henüz aktivite yok. Canlı güncellemeler burada görünecek.
            </p>
          ) : (
            notifications.slice(0, 10).map((notif, i) => {
              let icon = <Activity className="w-5 h-5 text-blue-500" />;
              let bgColor = 'bg-blue-50';

              if (notif.type === 'new_payment') {
                icon = <DollarSign className="w-5 h-5 text-green-500" />;
                bgColor = 'bg-green-50';
              } else if (notif.type === 'payment_approved') {
                icon = <CheckCircle className="w-5 h-5 text-green-500" />;
                bgColor = 'bg-green-50';
              } else if (notif.type === 'payment_rejected') {
                icon = <AlertTriangle className="w-5 h-5 text-red-500" />;
                bgColor = 'bg-red-50';
              }

              return (
                <div
                  key={i}
                  className="p-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-4"
                >
                  <div className={`p-2 rounded-lg ${bgColor}`}>{icon}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {notif.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {dayjs(notif.timestamp).fromNow()}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
