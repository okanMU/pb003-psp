import { Shield, AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react';
import { useState } from 'react';

/**
 * Calculate fraud score and risk level (mock - would come from backend)
 */
export const calculateFraudScore = (transaction) => {
  // Mock calculation based on amount, time, customer data
  let score = 0;
  const triggeredRules = [];

  // Amount anomaly
  if (transaction.amount > 50000) {
    score += 30;
    triggeredRules.push({
      type: 'AMOUNT_ANOMALY',
      message: 'Yüksek tutarlı işlem',
      severity: 7,
    });
  } else if (transaction.amount > 20000) {
    score += 15;
    triggeredRules.push({
      type: 'AMOUNT_ANOMALY',
      message: 'Orta-yüksek tutarlı işlem',
      severity: 4,
    });
  }

  // Velocity check (mock - random for demo)
  const velocityRisk = Math.random();
  if (velocityRisk > 0.7) {
    score += 25;
    triggeredRules.push({
      type: 'VELOCITY_CHECK',
      message: 'Kısa sürede çok sayıda işlem',
      severity: 8,
    });
  }

  // Email/phone missing
  if (!transaction.customerEmail || !transaction.customerPhone) {
    score += 10;
    triggeredRules.push({
      type: 'MISSING_DATA',
      message: 'Eksik müşteri bilgisi',
      severity: 3,
    });
  }

  // Time-based risk (late night)
  const hour = new Date().getHours();
  if (hour >= 0 && hour <= 5) {
    score += 15;
    triggeredRules.push({
      type: 'SUSPICIOUS_PATTERN',
      message: 'Gece saatlerinde işlem',
      severity: 5,
    });
  }

  // Determine risk level
  let riskLevel, riskColor, riskLabel, riskIcon;
  if (score < 25) {
    riskLevel = 'LOW';
    riskColor = 'green';
    riskLabel = 'Düşük Risk';
    riskIcon = CheckCircle;
  } else if (score < 50) {
    riskLevel = 'MEDIUM';
    riskColor = 'yellow';
    riskLabel = 'Orta Risk';
    riskIcon = Info;
  } else if (score < 75) {
    riskLevel = 'HIGH';
    riskColor = 'orange';
    riskLabel = 'Yüksek Risk';
    riskIcon = AlertTriangle;
  } else {
    riskLevel = 'CRITICAL';
    riskColor = 'red';
    riskLabel = 'Kritik Risk';
    riskIcon = XCircle;
  }

  return {
    score,
    riskLevel,
    riskColor,
    riskLabel,
    riskIcon,
    triggeredRules,
    requiresManualReview: score >= 50,
  };
};

/**
 * Fraud Score Card Component
 */
export default function FraudScoreCard({ transaction, compact = false }) {
  const [showDetails, setShowDetails] = useState(false);
  const fraudData = calculateFraudScore(transaction);
  const Icon = fraudData.riskIcon;

  if (compact) {
    return (
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all hover:scale-105 bg-${fraudData.riskColor}-100 text-${fraudData.riskColor}-800 border-2 border-${fraudData.riskColor}-200`}
      >
        <Icon className="w-4 h-4" />
        {fraudData.riskLabel}
        <span className="text-xs opacity-75">({fraudData.score})</span>
      </button>
    );
  }

  return (
    <div className={`rounded-xl border-2 overflow-hidden bg-${fraudData.riskColor}-50 border-${fraudData.riskColor}-200`}>
      {/* Header */}
      <div className={`p-4 bg-${fraudData.riskColor}-100`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 bg-${fraudData.riskColor}-200 rounded-lg`}>
              <Shield className={`w-6 h-6 text-${fraudData.riskColor}-700`} />
            </div>
            <div>
              <h3 className={`font-bold text-${fraudData.riskColor}-900`}>
                {fraudData.riskLabel}
              </h3>
              <p className={`text-sm text-${fraudData.riskColor}-700`}>
                Risk Skoru: {fraudData.score}/100
              </p>
            </div>
          </div>
          <div className={`text-3xl font-bold text-${fraudData.riskColor}-700`}>
            {fraudData.score}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-gray-200">
        <div
          className={`h-full bg-${fraudData.riskColor}-500 transition-all duration-500`}
          style={{ width: `${fraudData.score}%` }}
        ></div>
      </div>

      {/* Details Toggle */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`w-full p-3 text-sm font-semibold text-${fraudData.riskColor}-800 hover:bg-${fraudData.riskColor}-100 transition`}
      >
        {showDetails ? '▼ Detayları Gizle' : '▶ Detayları Göster'}
      </button>

      {/* Triggered Rules */}
      {showDetails && fraudData.triggeredRules.length > 0 && (
        <div className="p-4 border-t">
          <h4 className="font-semibold text-gray-900 mb-3 text-sm">
            Tespit Edilen Kurallar:
          </h4>
          <div className="space-y-2">
            {fraudData.triggeredRules.map((rule, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm bg-white p-2 rounded-lg"
              >
                <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{rule.message}</p>
                  <p className="text-xs text-gray-500">
                    Önem: {rule.severity}/10
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation */}
      {showDetails && (
        <div className="p-4 border-t bg-white">
          <h4 className="font-semibold text-gray-900 mb-2 text-sm">
            Öneri:
          </h4>
          <p className="text-sm text-gray-700">
            {fraudData.score < 25 && (
              <>
                ✅ Bu işlem düşük riskli. <strong>Onaylanabilir</strong>.
              </>
            )}
            {fraudData.score >= 25 && fraudData.score < 50 && (
              <>
                ⚠️ Orta seviye risk. <strong>Manuel kontrol yapılması önerilir</strong>.
              </>
            )}
            {fraudData.score >= 50 && fraudData.score < 75 && (
              <>
                🔍 Yüksek risk. <strong>Dikkatli incelenmeli</strong>. Müşteri
                geçmişini ve işlem detaylarını kontrol edin.
              </>
            )}
            {fraudData.score >= 75 && (
              <>
                ❌ Kritik risk seviyesi. <strong>Reddetmeniz önerilir</strong>.
                Şüpheli aktivite tespit edildi.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Smart Approval Actions Component
 * Shows recommended actions based on fraud score
 */
export function SmartApprovalActions({ transactions, onApprove, onReject }) {
  if (!transactions || transactions.length === 0) return null;

  const categorized = {
    safe: [],
    review: [],
    suspicious: [],
    critical: [],
  };

  transactions.forEach((tx) => {
    const fraudData = calculateFraudScore(tx);
    if (fraudData.score < 25) categorized.safe.push(tx);
    else if (fraudData.score < 50) categorized.review.push(tx);
    else if (fraudData.score < 75) categorized.suspicious.push(tx);
    else categorized.critical.push(tx);
  });

  const handleBulkAction = (txList, action) => {
    txList.forEach((tx) => {
      if (action === 'approve') {
        onApprove(tx.id);
      } else {
        onReject(tx.id, 'Otomatik risk analizi - yüksek risk skoru');
      }
    });
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-6 h-6 text-blue-600" />
        <h3 className="text-lg font-bold text-gray-900">
          Akıllı Onaylama Önerileri
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Safe to Approve */}
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h4 className="font-semibold text-green-900">Güvenli</h4>
          </div>
          <p className="text-2xl font-bold text-green-700 mb-1">
            {categorized.safe.length}
          </p>
          <p className="text-xs text-green-700 mb-3">işlem</p>
          {categorized.safe.length > 0 && (
            <button
              onClick={() => handleBulkAction(categorized.safe, 'approve')}
              className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition"
            >
              Tümünü Onayla
            </button>
          )}
        </div>

        {/* Needs Review */}
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-5 h-5 text-yellow-600" />
            <h4 className="font-semibold text-yellow-900">İncelenmeli</h4>
          </div>
          <p className="text-2xl font-bold text-yellow-700 mb-1">
            {categorized.review.length}
          </p>
          <p className="text-xs text-yellow-700 mb-3">işlem</p>
          <p className="text-xs text-yellow-800">
            Manuel kontrol gerekiyor
          </p>
        </div>

        {/* Suspicious */}
        <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <h4 className="font-semibold text-orange-900">Şüpheli</h4>
          </div>
          <p className="text-2xl font-bold text-orange-700 mb-1">
            {categorized.suspicious.length}
          </p>
          <p className="text-xs text-orange-700 mb-3">işlem</p>
          <p className="text-xs text-orange-800">
            Dikkatli incelenmeli
          </p>
        </div>

        {/* Critical */}
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <h4 className="font-semibold text-red-900">Kritik</h4>
          </div>
          <p className="text-2xl font-bold text-red-700 mb-1">
            {categorized.critical.length}
          </p>
          <p className="text-xs text-red-700 mb-3">işlem</p>
          {categorized.critical.length > 0 && (
            <button
              onClick={() => handleBulkAction(categorized.critical, 'reject')}
              className="w-full py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition"
            >
              Tümünü Reddet
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 p-3 bg-blue-100 rounded-lg">
        <p className="text-sm text-blue-900">
          💡 <strong>İpucu:</strong> Güvenli işlemleri toplu onaylayabilir,
          kritik risk taşıyanları otomatik reddedebilirsiniz. Orta risk
          seviyesindekiler manuel kontrol gerektirir.
        </p>
      </div>
    </div>
  );
}
