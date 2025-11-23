import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  CreditCard,
  Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

/**
 * Customer-facing realtime payment widget
 * Müşterilerin ödeme durumunu canlı takip etmesi için
 */
export default function PaymentWidget() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [copied, setCopied] = useState({});
  const [confirming, setConfirming] = useState(false);
  const socketRef = useRef(null);

  // Fetch payment details
  useEffect(() => {
    const fetchPayment = async () => {
      try {
        const response = await axios.get(
          `http://localhost:3000/api/v1/payments/${paymentId}`
        );
        setPayment(response.data);
        setLoading(false);

        // Calculate initial time remaining
        if (response.data.expires_at) {
          const expiresAt = new Date(response.data.expires_at);
          const now = new Date();
          const seconds = Math.max(0, Math.floor((expiresAt - now) / 1000));
          setTimeRemaining(seconds);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Ödeme bulunamadı');
        setLoading(false);
      }
    };

    fetchPayment();
  }, [paymentId]);

  // WebSocket connection
  useEffect(() => {
    if (!paymentId) return;

    // Connect to payment namespace
    const socket = io('http://localhost:3000/payment', {
      transports: ['websocket'],
      reconnection: true,
    });

    socket.on('connect', () => {
      console.log('✅ Customer WebSocket connected');
      // Subscribe to this payment
      socket.emit('subscribe', { paymentId });
    });

    socket.on('disconnect', () => {
      console.log('❌ Customer WebSocket disconnected');
    });

    // Payment status updates
    socket.on('payment:status', (data) => {
      console.log('📊 Payment status:', data);
      setPayment((prev) => ({ ...prev, ...data }));
    });

    socket.on('payment:updated', (data) => {
      console.log('🔄 Payment updated:', data);
      setPayment((prev) => ({ ...prev, ...data }));

      // Show notifications
      if (data.status === 'APPROVED') {
        toast.success('✅ Ödemeniz onaylandı!', { duration: 5000 });
      } else if (data.status === 'REJECTED') {
        toast.error(`❌ Ödemeniz reddedildi: ${data.reason || 'Bilinmeyen sebep'}`, {
          duration: 7000,
        });
      } else if (data.status === 'EXPIRED') {
        toast.error('⏰ Ödeme süresi doldu', { duration: 5000 });
      }
    });

    socket.on('payment:processing', (data) => {
      console.log('⏳ Payment processing:', data);
      toast.loading('İşleminiz kontrol ediliyor...', { duration: 2000 });
    });

    socket.on('timer:update', (data) => {
      setTimeRemaining(data.secondsRemaining);
    });

    socket.on('bank:status_changed', (data) => {
      if (data.bank_status === 'suspended') {
        toast.error('⚠️ Banka hesabı geçici olarak kullanılamıyor', {
          duration: 5000,
        });
      }
    });

    socketRef.current = socket;

    return () => {
      socket.emit('unsubscribe', { paymentId });
      socket.disconnect();
    };
  }, [paymentId]);

  // Countdown timer
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining]);

  // Copy to clipboard helper
  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied({ ...copied, [field]: true });
    toast.success('Kopyalandı!');
    setTimeout(() => {
      setCopied({ ...copied, [field]: false });
    }, 2000);
  };

  // "I paid" confirmation
  const handleConfirmPayment = async () => {
    setConfirming(true);
    try {
      // In real implementation, this would notify the system
      toast.success('Ödeme bildiriminiz alındı. İşleminiz kontrol ediliyor...');
      // Could emit a socket event or API call here
    } catch (err) {
      toast.error('Bir hata oluştu');
    } finally {
      setConfirming(false);
    }
  };

  // Format time remaining
  const formatTime = (seconds) => {
    if (seconds === null) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Ödeme bilgileri yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Hata</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  const isExpired = timeRemaining === 0 || payment?.status === 'EXPIRED';
  const isApproved = payment?.status === 'APPROVED';
  const isRejected = payment?.status === 'REJECTED';
  const isPending = payment?.status === 'PENDING';

  // Status component
  const StatusBadge = () => {
    if (isApproved) {
      return (
        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 text-center mb-6">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-3 animate-bounce" />
          <h3 className="text-2xl font-bold text-green-900 mb-2">
            Ödeme Onaylandı!
          </h3>
          <p className="text-green-700">
            İşleminiz başarıyla tamamlandı. Teşekkür ederiz.
          </p>
        </div>
      );
    }

    if (isRejected) {
      return (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 text-center mb-6">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-red-900 mb-2">
            Ödeme Reddedildi
          </h3>
          <p className="text-red-700">
            {payment?.reason || 'Lütfen müşteri hizmetleri ile iletişime geçin.'}
          </p>
        </div>
      );
    }

    if (isExpired) {
      return (
        <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-6 text-center mb-6">
          <Clock className="w-16 h-16 text-orange-500 mx-auto mb-3" />
          <h3 className="text-2xl font-bold text-orange-900 mb-2">
            Süre Doldu
          </h3>
          <p className="text-orange-700">
            Ödeme süresi doldu. Lütfen yeni bir ödeme başlatın.
          </p>
        </div>
      );
    }

    return (
      <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 text-center mb-6">
        <Clock className="w-12 h-12 text-blue-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          Ödeme Bekleniyor
        </h3>
        <div className="text-4xl font-bold text-blue-600 mb-2">
          {formatTime(timeRemaining)}
        </div>
        <p className="text-blue-700 text-sm">Kalan süre</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            💳 Ödeme İşlemi
          </h1>
          <p className="text-gray-600">
            Referans Kodu: <span className="font-mono font-bold">{payment?.code}</span>
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Status Banner */}
          <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm mb-1">Ödenecek Tutar</p>
                <p className="text-4xl font-bold">
                  {payment?.amount?.toLocaleString('tr-TR')} ₺
                </p>
              </div>
              <CreditCard className="w-12 h-12 text-blue-200" />
            </div>
          </div>

          <div className="p-6">
            {/* Status */}
            <StatusBadge />

            {/* Bank Info - Only show if pending */}
            {isPending && !isExpired && (
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-2 text-gray-700 mb-4">
                  <Building2 className="w-5 h-5" />
                  <h3 className="font-semibold text-lg">Banka Bilgileri</h3>
                </div>

                {/* IBAN */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <label className="text-sm text-gray-600 block mb-2">IBAN</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono font-semibold text-gray-900 break-all">
                      {payment?.bank?.iban || 'TR00 0000 0000 0000 0000 0000 00'}
                    </code>
                    <button
                      onClick={() =>
                        copyToClipboard(payment?.bank?.iban, 'iban')
                      }
                      className="p-2 hover:bg-gray-200 rounded-lg transition flex-shrink-0"
                    >
                      {copied.iban ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Amount */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <label className="text-sm text-gray-600 block mb-2">Tutar</label>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 font-semibold text-2xl text-gray-900">
                      {payment?.amount?.toLocaleString('tr-TR')} ₺
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(payment?.amount?.toString(), 'amount')
                      }
                      className="p-2 hover:bg-gray-200 rounded-lg transition flex-shrink-0"
                    >
                      {copied.amount ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Reference Code */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <label className="text-sm text-gray-600 block mb-2">
                    Açıklama (Mutlaka yazın!)
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono font-bold text-xl text-blue-600">
                      {payment?.code}
                    </code>
                    <button
                      onClick={() => copyToClipboard(payment?.code, 'code')}
                      className="p-2 hover:bg-gray-200 rounded-lg transition flex-shrink-0"
                    >
                      {copied.code ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Warning */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold mb-1">Önemli!</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Açıklama kısmına mutlaka referans kodunu yazın</li>
                      <li>Tam tutarı gönderin (eksik veya fazla göndermeyin)</li>
                      <li>İşleminiz 1-5 dakika içinde kontrol edilecektir</li>
                    </ul>
                  </div>
                </div>

                {/* Confirm Button */}
                <button
                  onClick={handleConfirmPayment}
                  disabled={confirming}
                  className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Bildiriliyor...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Ödemeyi Yaptım
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Customer Info */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold text-gray-700 mb-3">Müşteri Bilgileri</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-600">İsim</p>
                  <p className="font-semibold text-gray-900">
                    {payment?.customer_name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">E-posta</p>
                  <p className="font-semibold text-gray-900">
                    {payment?.customer_email || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Telefon</p>
                  <p className="font-semibold text-gray-900">
                    {payment?.customer_phone || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Durum</p>
                  <p className="font-semibold text-gray-900">
                    <StatusPill status={payment?.status} />
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Help */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Sorun mu yaşıyorsunuz?{' '}
            <a href="#" className="text-blue-600 hover:underline">
              Destek ekibiyle iletişime geçin
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// Status pill component
function StatusPill({ status }) {
  const styles = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    PROCESSING: 'bg-blue-100 text-blue-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    EXPIRED: 'bg-gray-100 text-gray-800',
  };

  const labels = {
    PENDING: 'Bekliyor',
    PROCESSING: 'İşleniyor',
    APPROVED: 'Onaylandı',
    REJECTED: 'Reddedildi',
    EXPIRED: 'Süresi Doldu',
  };

  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
        styles[status] || 'bg-gray-100 text-gray-800'
      }`}
    >
      {labels[status] || status}
    </span>
  );
}
