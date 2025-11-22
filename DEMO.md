# PSP MVP - Demo Senaryoları

## Senaryo 1: E-Ticaret Entegrasyonu

### Adım 1: Sistem Başlatma

```bash
# Terminal 1: Backend
cd backend
npm install
cp .env.example .env
# .env dosyasını düzenleyin (PostgreSQL ve Redis ayarları)
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev

# Terminal 2: Admin Panel
cd admin-panel
npm install
npm run dev

# Terminal 3: SDK Demo
cd sdk
npm install
npm run build
npm run demo
```

### Adım 2: Ödeme Akışı

1. **SDK Demo Sayfası** (http://localhost:3000)
   - Tutar girin: 1500 TRY
   - Email: customer@example.com
   - "Ödeme Oluştur" butonuna tıklayın

2. **Payment Widget Açılır** (Real-time)
   - Ref kod gösterilir: PAY123ABC
   - Banka bilgileri görünür
   - Countdown timer başlar (30 dakika)
   - WebSocket bağlantısı aktif

3. **Admin Panel** (http://localhost:5173)
   - Real-time bildirim alır: "Yeni ödeme: PAY123ABC - 1500 TRY"
   - Dashboard stats güncellenir
   - "Manuel Kontrol" sayfasına gidin

4. **Manuel Banka Kontrolü**
   - Bekleyen ödeme listesinde görünür
   - Banka: Garanti BBVA
   - Ref Kod: PAY123ABC
   - Tutar: 1500 TRY
   - Kalan süre: 29 dakika

5. **Admin Onaylama**
   - "Onayla" butonuna tıklayın
   - Komisyon otomatik hesaplanır
   - Webhook platforma gönderilir

6. **Real-time Güncelleme**
   - Customer widget'ı anında güncellenir
   - Başarı ekranı gösterilir: ✅ "Ödeme Onaylandı!"
   - Admin panel bildirim alır

## Senaryo 2: Toplu Onaylama

### Manuel Kontrol Senaryosu

Admin sabah bankaya giriş yapar:

```
Garanti BBVA Hesabı:
--------------------
09:15  1,500 TRY  Gönderen: Ahmet Y.  Açıklama: PAY123ABC
09:23  2,300 TRY  Gönderen: Mehmet K. Açıklama: PAY456DEF
09:47  5,000 TRY  Gönderen: Ayşe T.   Açıklama: PAY789GHI
```

**Admin Panel İşlemi:**

1. Manuel Kontrol sayfasında Garanti BBVA'yı seç
2. 3 bekleyen işlem görünür
3. Tümünü checkbox ile işaretle
4. "Seçilenleri Onayla (3)" butonuna tıkla
5. Toplu onaylama tamamlanır
6. 3 webhook platformlara gönderilir
7. 3 müşteri real-time bildirim alır

## Senaryo 3: Real-time Event Flow

### WebSocket Events Test

```javascript
// Terminal 4: Test script
node test-websocket.js
```

```javascript
// test-websocket.js
const io = require('socket.io-client');

// Customer socket
const customerSocket = io('http://localhost:3000/payment');
customerSocket.on('connect', () => {
  console.log('Customer connected');
  customerSocket.emit('subscribe', { paymentId: 'xxx' });
});

customerSocket.on('payment:status', (data) => {
  console.log('📱 Customer received:', data);
});

customerSocket.on('payment:updated', (data) => {
  console.log('📱 Payment updated:', data.status);
});

// Admin socket
const adminSocket = io('http://localhost:3000/admin');
adminSocket.on('notification', (data) => {
  console.log('🔔 Admin notification:', data.message);
});

adminSocket.on('dashboard:update', (data) => {
  console.log('📊 Dashboard update:', data);
});
```

## Senaryo 4: Webhook Delivery

### Platform Webhook Testi

```javascript
// Express webhook endpoint
app.post('/webhooks/psp', express.json(), (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const { event, data } = req.body;

  console.log('Webhook received:', event);

  if (event === 'payment.approved') {
    const { paymentId, code, amount, commission } = data;

    // Update order in database
    await Order.update({
      where: { pspPaymentId: paymentId },
      data: {
        status: 'paid',
        paidAt: new Date(),
      }
    });

    console.log(`Order paid: ${code} - ${amount} TRY`);
  }

  res.send('OK');
});
```

**Test:**

```bash
# ngrok ile public URL oluştur
ngrok http 4000

# Platform webhook URL'ini güncelle
# http://xxxxx.ngrok.io/webhooks/psp

# Ödeme onayla -> Webhook otomatik gönderilir
```

## Senaryo 5: Timeout ve Expiration

### Otomatik Süre Dolumu

1. Ödeme oluştur
2. 30 dakika bekle (veya sistem saatini değiştir)
3. Cron job çalışır: `npm run prisma:studio`
4. Transaction status: PENDING → EXPIRED
5. WebSocket event: `payment:expired`
6. Customer widget güncellenir: ❌ "Süre Doldu"

## Senaryo 6: Red (Rejection)

1. Ödeme oluştur
2. Admin manuel kontrolde "Reddet" butonuna tıklar
3. Sebep girer: "Tutar uyuşmuyor"
4. Payment status: REJECTED
5. Webhook gönderilir
6. Customer bildirim alır

## Performans Testi

### Load Test

```bash
# Apache Bench ile 1000 ödeme oluştur
ab -n 1000 -c 10 -T 'application/json' \
   -H 'X-Api-Key: pk_test_demo_platform' \
   -p payment.json \
   http://localhost:3000/api/v1/payments

# payment.json
{
  "amount": 100,
  "customer": {
    "email": "test@example.com"
  }
}
```

## Monitoring

### Redis Monitor

```bash
redis-cli monitor
```

Gözlemlenecekler:
- `payment:created` pub/sub events
- `payment:approved` pub/sub events
- Cache operations (SET, GET)

### PostgreSQL Queries

```bash
# Canlı sorguları izle
npm run prisma:studio

# veya
psql psp_db -c "SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10;"
```

### WebSocket Connections

```bash
# Backend logs
npm run dev

# WebSocket bağlantılarını gör:
# ✅ Payment WebSocket Gateway initialized
# 🔌 Payment client connected: xxx
# 📡 Client xxx subscribed to payment yyy
```

## Hata Senaryoları

### 1. Network Error (Webhook Retry)

```bash
# Platform webhook endpoint'ini kapat
# Ödemeyi onayla
# Backend logs:
# ❌ Webhook failed: xxx - connect ECONNREFUSED
# 5 dakika sonra otomatik retry
# 3 deneme sonra FAILED olarak işaretlenir
```

### 2. Invalid API Key

```javascript
const pspay = new PSPay({ apiKey: 'invalid_key' });
const payment = await pspay.createPayment({ amount: 100 });
// Error: Payment creation failed: Unauthorized
```

### 3. Duplicate Approval

```
Admin 1: Ödeme PAY123 onayladı
Admin 2: Aynı ödemeyi onaylamaya çalışır
Response: "Payment is not pending"
```

## Başarı Kriterleri

- ✅ Real-time bildirimler 1 saniyeden kısa sürede iletilir
- ✅ Webhook delivery %99.9+ success rate (retry ile)
- ✅ 1000 concurrent payment creation
- ✅ WebSocket 500+ simultaneous connections
- ✅ Admin panel smooth operation (no lag)
- ✅ SDK widget responsive ve mobile-friendly
- ✅ Commission calculation accurate (0.5% PSP + %1.5 Platform)
- ✅ Redis caching reduces DB load %80+

## Production Features

1. **Advanced Features**
   - Multi-currency support
   - Partial payments
   - Refunds
   - Recurring payments

2. **Analytics Dashboard**
   - Grafik ve raporlar
   - Export to Excel/PDF
   - Real-time raporlama

3. **Security & Performance**
   - Advanced authentication (2FA)
   - Audit logs
   - Performance monitoring
   - Load balancing
