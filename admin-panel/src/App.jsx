import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import DashboardEnhanced from './pages/DashboardEnhanced';
import ManualCheck from './pages/ManualCheck';
import ManualCheckEnhanced from './pages/ManualCheckEnhanced';
import PaymentWidget from './pages/PaymentWidget';
import PlatformDashboard from './pages/PlatformDashboard';
import StatementImport from './pages/StatementImport';
import AdvancedAnalytics from './pages/AdvancedAnalytics';
import AutomationRules from './pages/AutomationRules';
import { WebSocketProvider } from './context/WebSocketContext';

function App() {
  return (
    <WebSocketProvider>
      <BrowserRouter>
        <Routes>
          {/* Customer-facing payment widget (no layout) */}
          <Route path="/payment/:paymentId" element={<PaymentWidget />} />

          {/* Admin panel routes (with layout) */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardEnhanced />} />
            <Route path="dashboard-old" element={<Dashboard />} />
            <Route path="manual-check" element={<ManualCheckEnhanced />} />
            <Route path="manual-check-old" element={<ManualCheck />} />
            <Route path="platform" element={<PlatformDashboard />} />
            <Route path="statement-import" element={<StatementImport />} />
            <Route path="analytics" element={<AdvancedAnalytics />} />
            <Route path="automation" element={<AutomationRules />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </WebSocketProvider>
  );
}

export default App;
