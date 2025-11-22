# 🚀 Quick Start Guide

## Ön Gereksinimler

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- npm veya yarn

## 1️⃣ Kurulum (Toplam ~5 dakika)

### Adım 1: Clone & Install

```bash
git clone <repository-url>
cd pb003-psp

# Tüm bağımlılıkları kur
npm run install:all
```

### Adım 2: Database & Redis Ayarları

**PostgreSQL:**
```bash
# PostgreSQL başlat
brew services start postgresql  # macOS
sudo systemctl start postgresql # Linux

# Database oluştur
createdb psp_db
```

**Redis:**
```bash
# Redis başlat
brew services start redis       # macOS
sudo systemctl start redis      # Linux
```

### Adım 3: Backend .env

```bash
cd backend
cp .env.example .env
```

`.env` dosyasını düzenleyin:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/psp_db?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-super-secret-key
PORT=3000
```

### Adım 4: Prisma Setup

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Seed sonrası oluşan veriler:
- Admin user: admin@psp.local / admin123
- Platform: Demo E-Commerce (API Key: pk_test_demo_platform)
- 3 Banka: Garanti, İş Bankası, Akbank

## 2️⃣ Sistemleri Başlat (3 Terminal)

### Terminal 1: Backend

```bash
cd backend
npm run dev

# Çıktı:
# ✅ Database connected
# ✅ Redis connected
# ✅ Payment WebSocket Gateway initialized
# ✅ Admin WebSocket Gateway initialized
# 🚀 PSP Backend API running on http://localhost:3000
```

### Terminal 2: Admin Panel

```bash
cd admin-panel
npm run dev

# Çıktı:
# VITE v5.0.11  ready in 1234 ms
# ➜  Local:   http://localhost:5173/
```

### Terminal 3: SDK Demo

```bash
cd sdk
npm run build
npm run demo

# Çıktı:
# Serving!
# Local:  http://localhost:3000
```

## 3️⃣ İlk Test (2 dakika)

### Test 1: SDK Demo

1. http://localhost:3000 açın (SDK Demo)
2. Tutar: 1500
3. Email: test@example.com
4. "Ödeme Oluştur" butonuna tıklayın
5. Widget açılır → Ref kod ve banka bilgileri görünür

### Test 2: Admin Panel

1. http://localhost:5173 açın (Admin Panel)
2. Real-time bildirim gelir: "Yeni ödeme: PAYXXXXXX"
3. Dashboard stats güncellenir
4. "Manuel Kontrol" sekmesine tıklayın
5. Bekleyen ödemeyi görürsünüz

### Test 3: Manuel Onaylama

1. Admin Panel → Manuel Kontrol
2. Banka seçin (örn: Garanti BBVA)
3. İşlemi seçin
4. "Onayla" butonuna tıklayın
5. SDK Demo widget'ı real-time güncellenir: ✅ "Ödeme Onaylandı!"

## 4️⃣ API Test (Postman/cURL)

### Create Payment

```bash
curl -X POST http://localhost:3000/api/v1/payments \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: pk_test_demo_platform" \
  -d '{
    "amount": 2500,
    "customer": {
      "email": "customer@example.com",
      "phone": "+905551234567"
    }
  }'
```

Response:
```json
{
  "id": "clx...",
  "code": "PAY123ABC",
  "amount": 2500,
  "status": "PENDING",
  "bank": {
    "name": "Garanti BBVA",
    "iban": "TR330006100519786457841326",
    "account_name": "PSP ÖDEME HİZMETLERİ A.Ş."
  },
  "expires_at": "2024-01-15T10:30:00Z"
}
```

### Get Payment Status

```bash
curl http://localhost:3000/api/v1/payments/PAY123ABC
```

### Admin: Get Pending Payments

```bash
curl http://localhost:3000/api/v1/admin/payments/pending
```

### Admin: Approve Payment

```bash
curl -X POST http://localhost:3000/api/v1/admin/payments/<payment-id>/approve \
  -H "Content-Type: application/json" \
  -d '{
    "adminId": "admin-user-id"
  }'
```

## 5️⃣ WebSocket Test

### Test Real-time Events

Browser Console (SDK Demo sayfasında F12):

```javascript
// Admin events dinle
const socket = io('http://localhost:3000/admin');

socket.on('notification', (data) => {
  console.log('🔔', data.message);
});

socket.on('dashboard:update', (data) => {
  console.log('📊', data);
});

// Payment events dinle
const paymentSocket = io('http://localhost:3000/payment');

paymentSocket.emit('subscribe', { paymentId: 'xxx' });

paymentSocket.on('payment:updated', (data) => {
  console.log('💳', data.status);
});
```

## 6️⃣ Troubleshooting

### PostgreSQL bağlantı hatası
```bash
# PostgreSQL çalışıyor mu?
pg_isready

# Database var mı?
psql -l | grep psp_db

# Yoksa oluştur
createdb psp_db
```

### Redis bağlantı hatası
```bash
# Redis çalışıyor mu?
redis-cli ping
# PONG dönmeli

# Yoksa başlat
redis-server
```

### Port zaten kullanımda
```bash
# Port 3000 kim kullanıyor?
lsof -i :3000

# Process'i kapat
kill -9 <PID>

# Veya .env'de PORT değiştir
PORT=3001
```

### Prisma migration hatası
```bash
# Migration sıfırla
cd backend
rm -rf prisma/migrations
npm run prisma:migrate
npm run prisma:seed
```

## 7️⃣ Sonraki Adımlar

- [ ] Demo senaryolarını dene: `DEMO.md`
- [ ] Webhook entegrasyonu: `sdk/README.md`
- [ ] Load testing: `DEMO.md` → Performans Testi
- [ ] Production deployment: `README.md` → Deployment

## 8️⃣ Yararlı Komutlar

```bash
# Prisma Studio (Database GUI)
cd backend && npm run prisma:studio

# Redis Monitor
redis-cli monitor

# Backend logs
cd backend && npm run dev

# Admin panel build
cd admin-panel && npm run build

# SDK build
cd sdk && npm run build

# Tüm sistemleri build et
npm run build:all
```

## Yardım

Sorun yaşarsanız:
1. Tüm terminalleri kapatın
2. Redis ve PostgreSQL'i restart edin
3. `node_modules` klasörlerini silin
4. `npm run install:all` çalıştırın
5. Adımları tekrarlayın

Başarılar! 🚀
