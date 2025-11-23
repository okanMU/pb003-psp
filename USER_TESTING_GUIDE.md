# 🧪 PSP Sistemi - Son Kullanıcı Test Kılavuzu

## ✅ Proje Durumu Özeti

### Tamamlanan Bileşenler

#### 1. Backend API (NestJS) ✅
- **Durum:** %100 Tamamlandı
- **Dosya Sayısı:** 89 TypeScript dosyası
- **Modüller:**
  - ✅ Payment Service (Ödeme yönetimi)
  - ✅ Bank Owner Service (Banka sahibi işlemleri)
  - ✅ Auth Module (JWT kimlik doğrulama)
  - ✅ WebSocket Gateways (Real-time iletişim)
  - ✅ Collateral Management (Teminat yönetimi)
  - ✅ Webhook Service (Platform webhook'ları)
  - ✅ Security & Fraud Detection (Güvenlik ve dolandırıcılık önleme)
  - ✅ Admin Module (Yönetim paneli API'leri)
  - ✅ Health Check (Sistem sağlık kontrolü)

#### 2. Database (PostgreSQL + Prisma) ✅
- **Schema:** Tam ve kapsamlı (320 satır)
- **Tablolar:** 9 ana tablo
  - users, platforms, banks, transactions
  - payment_events, webhook_logs, collateral_locks
  - settings, security_events
- **Migrations:** ✅ Oluşturuldu (`20241123000000_init`)
- **Seed Data:** ✅ Hazır ve yapılandırılmış

#### 3. Admin Panel (React + Vite) ✅
- **Durum:** %100 Tamamlandı
- **Dosya Sayısı:** 25 component/page
- **Sayfalar:**
  - ✅ Dashboard (Normal + Enhanced)
  - ✅ Manual Check (Manuel kontrol - Normal + Enhanced)
  - ✅ Advanced Analytics (Gelişmiş analitik)
  - ✅ Automation Rules (Otomasyon kuralları)
  - ✅ Statement Import (Ekstre yükleme)
  - ✅ Payment Widget
  - ✅ Platform Dashboard
  - ✅ Fraud Score Card
  - ✅ Login & Protected Routes
- **Teknoloji:**
  - React 18, TailwindCSS, Socket.io, React Query
  - Recharts (Grafikler), Lucide Icons
  - Real-time WebSocket entegrasyonu

#### 4. SDK (TypeScript) ✅
- **Durum:** %100 Tamamlandı
- **Özellikler:**
  - ✅ TypeScript SDK (26KB+ kod)
  - ✅ Payment creation & status tracking
  - ✅ WebSocket real-time updates
  - ✅ Error handling & retry logic
  - ✅ Rollup bundler yapılandırması
- **Paketler:** CJS + ESM + TypeScript definitions

#### 5. SDK Test Console ✅
- **Durum:** %100 Tamamlandı
- **Dosya:** 735 satır standalone HTML
- **Paneller:**
  1. Payment Creation (Ödeme oluşturma)
  2. Customer Confirmation (Müşteri onayı)
  3. Payment Status (Durum kontrolü)
  4. Bank Owner Login (Banka sahibi girişi)
  5. Dashboard View (Dashboard görünümü)
  6. Approve/Reject (Onay/Red)
  7. WebSocket Logs (Real-time olaylar)

#### 6. Dokümantasyon ✅
- **README.md** - Genel proje tanıtımı
- **QUICKSTART.md** - Hızlı başlangıç (5 dakika)
- **DOCKER_QUICKSTART.md** - Docker ile kurulum
- **DEMO.md** - 6 farklı test senaryosu
- **sdk-test/README.md** - Test console kullanım kılavuzu

---

## 🚀 Kullanıcı Testine Başlamadan Önce

### Gerekli Ortam

1. **Docker + Docker Compose** (Önerilen)
   - Docker Desktop 4.0+
   - 8GB RAM minimum
   - Portlar: 3000, 5432, 6379

2. **Manuel Kurulum** (Alternatif)
   - Node.js 18+
   - PostgreSQL 15+
   - Redis 7+

---

## 📋 Test Öncesi Kontrol Listesi

### Adım 1: Docker ile Sistem Başlatma

```bash
# Proje dizinine git
cd pb003-psp

# Docker container'ları başlat
docker-compose up -d

# Logları izle (60 saniye bekle)
docker-compose logs -f backend
```

**Beklenen çıktı:**
```
✅ Created PSP Admin: admin@psp.local
✅ Created Bank Owner: owner@bank.local
✅ Created Test Bank: Garanti Bankası Test Hesabı
🎉 Seeding completed!
```

### Adım 2: Sistem Sağlık Kontrolü

```bash
# Backend health check
curl http://localhost:3000/api/v1/health

# PostgreSQL bağlantısı
docker-compose exec postgres psql -U psp_user -d psp_development -c "SELECT COUNT(*) FROM users;"

# Redis bağlantısı
docker-compose exec redis redis-cli ping
```

### Adım 3: Test Console Açma

**Yöntem 1: Doğrudan Dosya Açma**
```bash
# Tarayıcıda açın
open sdk-test/index.html
# veya
firefox sdk-test/index.html
# veya
chrome sdk-test/index.html
```

**Yöntem 2: HTTP Server**
```bash
cd sdk-test
python3 -m http.server 8080
# Tarayıcıda aç: http://localhost:8080
```

---

## 🧪 Temel Test Senaryoları

### Test 1: Basit Ödeme Akışı (Happy Path)

**Süre:** 2-3 dakika

1. **Test Console'da Panel 1: Create Payment**
   ```
   API Key: test_platform_api_key_12345
   Amount: 500
   Email: test@example.com
   Name: Ali Veli
   Phone: +905551234567
   ```
   - "Create Payment" butonuna tıkla
   - Transaction ID'yi kopyala

2. **Panel 2: Confirm Payment**
   - Transaction ID'yi yapıştır
   - "Confirm Payment" butonuna tıkla
   - ⏱️ 5 dakikalık countdown başlamalı

3. **Panel 4: Bank Owner Login**
   ```
   Email: owner@bank.local
   Password: owner123456
   ```
   - "Login" butonuna tıkla
   - ✅ JWT token kaydedilmeli

4. **Panel 5: Dashboard**
   - "Get Dashboard" butonuna tıkla
   - Görmeli:
     - Total collateral: 150,000 TRY
     - Locked: 500 TRY
     - Available: 149,500 TRY
     - Pending: 1 transaction

5. **Panel 6: Approve Payment**
   - Transaction ID otomatik dolu
   - Notes: "Para hesaba geldi"
   - "✅ Approve" butonuna tıkla
   - Status: APPROVED

6. **Panel 3: Check Status**
   - "Check Status" butonuna tıkla
   - Status: APPROVED görmeli
   - Countdown durmuş olmalı

**Beklenen Sonuç:** ✅ Ödeme başarıyla onaylandı

---

### Test 2: Real-time WebSocket Testi

**Süre:** 3-4 dakika

1. **Panel 7: WebSocket Logs**
   - "Connect WebSocket" butonuna tıkla
   - Bağlantı durumu: 🟢 Connected

2. **Yeni Ödeme Oluştur** (Panel 1)
   - Amount: 1000 TRY
   - Create Payment

3. **WebSocket Logs'ta Görmeli:**
   ```
   🔔 New payment awaiting approval
   📊 Dashboard updated
   💰 Collateral updated: 1000 TRY locked
   ```

4. **Müşteri Onayı** (Panel 2)
   - Confirm Payment
   - WebSocket: ⏰ Countdown started: 5:00

5. **Banka Sahibi Onayı** (Panel 6)
   - Approve
   - WebSocket: ✅ Payment approved
   - WebSocket: 💰 Collateral released

**Beklenen Sonuç:** ✅ Tüm olaylar real-time görüldü

---

### Test 3: Red (Rejection) Senaryosu

1. **Yeni Ödeme Oluştur**
   - Amount: 750 TRY
   - Email: reject@test.com

2. **Müşteri Onayı**
   - Confirm Payment

3. **Banka Sahibi Girişi**
   - Login (owner@bank.local)

4. **Rejection** (Panel 6)
   - "❌ Reject" butonuna tıkla
   - Reason: "Para hesaba gelmedi"
   - Reject

5. **Status Kontrolü** (Panel 3)
   - Status: REJECTED
   - Rejection reason görünmeli

**Beklenen Sonuç:** ✅ Ödeme başarıyla reddedildi

---

### Test 4: Timeout Senaryosu

1. **Yeni Ödeme Oluştur**
   - Amount: 200 TRY

2. **Müşteri Onayı**
   - Confirm Payment
   - 5 dakika countdown başlar

3. **5 Dakika Bekle**
   - Veya sistem saatini değiştir (test ortamında)

4. **Status Kontrolü**
   - Auto-refresh aktif et
   - 5 dakika sonra status: REJECTED
   - Rejection reason: "Approval timeout"

**Beklenen Sonuç:** ✅ Otomatik red yapıldı

---

### Test 5: Çoklu Ödeme Testi

1. **3 Ödeme Oluştur**
   - Payment 1: 500 TRY
   - Payment 2: 1000 TRY
   - Payment 3: 250 TRY

2. **Hepsini Onayla**
   - Confirm all 3

3. **Dashboard Kontrolü**
   - Pending: 3
   - Locked: 1,750 TRY
   - Available: 148,250 TRY

4. **Teker Teker Onayla**
   - Approve Payment 1
   - Dashboard: Pending 2, Locked 1,250
   - Approve Payment 2
   - Dashboard: Pending 1, Locked 250
   - Approve Payment 3
   - Dashboard: Pending 0, Locked 0

**Beklenen Sonuç:** ✅ Tüm ödemeler başarıyla işlendi

---

## 🐛 Bilinen Sorunlar ve Çözümler

### Sorun 1: Backend başlamıyor

**Çözüm:**
```bash
# Container'ları yeniden başlat
docker-compose down -v
docker-compose up -d

# 60 saniye bekle
docker-compose logs -f backend
```

### Sorun 2: "Connection refused" hatası

**Çözüm:**
```bash
# Container'ların sağlık durumunu kontrol et
docker-compose ps

# Hepsi "Up (healthy)" olmalı
# PostgreSQL ve Redis healthy olana kadar bekle
```

### Sorun 3: Test console bağlanamıyor

**Çözüm:**
```bash
# Backend'in çalıştığını doğrula
curl http://localhost:3000/api/v1/health

# CORS ayarları kontrol et
# docker-compose.yml içinde CORS_ORIGIN: "*" olmalı
```

### Sorun 4: WebSocket bağlanmıyor

**Çözüm:**
- Browser Console (F12) aç
- Network tab'ında WebSocket bağlantılarını kontrol et
- Backend loglarında "WebSocket client connected" mesajını ara

---

## 📊 Test Başarı Kriterleri

Aşağıdaki kriterlerin hepsi karşılanmalı:

- ✅ Backend başarıyla ayağa kalkıyor (health check OK)
- ✅ Database seed verileri oluşturuluyor
- ✅ Test console backend'e bağlanabiliyor
- ✅ Ödeme oluşturma çalışıyor (Payment creation)
- ✅ Müşteri onayı çalışıyor (Customer confirmation)
- ✅ 5 dakikalık countdown başlıyor
- ✅ Banka sahibi login çalışıyor
- ✅ Dashboard real-time güncelleniyor
- ✅ Teminat kilitleme/serbest bırakma çalışıyor
- ✅ Onaylama işlemi çalışıyor (Approval)
- ✅ Reddetme işlemi çalışıyor (Rejection)
- ✅ Timeout mekanizması çalışıyor
- ✅ WebSocket real-time bildirimler çalışıyor
- ✅ Çoklu ödeme senaryosu çalışıyor

---

## 🎯 Performans Hedefleri

| İşlem | Hedef Süre | Ölçüm |
|-------|------------|-------|
| Payment Creation | < 200ms | Panel 1 response time |
| Customer Confirmation | < 100ms | Panel 2 response time |
| Status Check | < 50ms | Panel 3 response time |
| Login | < 150ms | Panel 4 response time |
| Dashboard Load | < 100ms | Panel 5 response time |
| Approve/Reject | < 150ms | Panel 6 response time |
| WebSocket Event | < 50ms | Panel 7 event lag |

---

## 📝 Test Sonuçları Raporu

Test sonunda aşağıdaki formu doldurun:

```markdown
## Test Raporu - [Tarih]

### Test Edilen Senaryolar
- [ ] Test 1: Basit Ödeme Akışı
- [ ] Test 2: Real-time WebSocket
- [ ] Test 3: Red Senaryosu
- [ ] Test 4: Timeout Senaryosu
- [ ] Test 5: Çoklu Ödeme

### Bulunan Hatalar
1. [Hata açıklaması]
2. [Hata açıklaması]

### Performans Notları
- Payment creation: [X]ms
- Dashboard load: [X]ms
- WebSocket latency: [X]ms

### Genel Değerlendirme
- Sistem Kararlılığı: ⭐⭐⭐⭐⭐ (1-5)
- Kullanıcı Deneyimi: ⭐⭐⭐⭐⭐ (1-5)
- Performans: ⭐⭐⭐⭐⭐ (1-5)
- Dokümantasyon Kalitesi: ⭐⭐⭐⭐⭐ (1-5)

### Öneriler
- [Öneri 1]
- [Öneri 2]
```

---

## 🔧 İleri Seviye Testler

### Load Testing

```bash
# Apache Bench ile 100 ödeme oluştur
ab -n 100 -c 10 -T 'application/json' \
   -H 'X-Api-Key: test_platform_api_key_12345' \
   -p payment.json \
   http://localhost:3000/api/v1/payments
```

### Database İzleme

```bash
# Prisma Studio ile database görselleştir
cd backend
npx prisma studio
# Open: http://localhost:5555
```

### Redis İzleme

```bash
# Redis monitor
docker-compose exec redis redis-cli monitor
```

---

## 📞 Destek ve Yardım

**Sorun yaşarsanız:**

1. **Logları kontrol edin:**
   ```bash
   docker-compose logs -f backend
   ```

2. **Browser Console'u açın:**
   - F12 → Console tab
   - Network tab → WebSocket bağlantılarını kontrol et

3. **Database'i kontrol edin:**
   ```bash
   cd backend && npx prisma studio
   ```

4. **Sistemi sıfırlayın:**
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

---

## ✅ Sonuç

Proje **son kullanıcı testine %100 hazır** durumda:

- ✅ Backend tamamen fonksiyonel
- ✅ Database schema ve migrations hazır
- ✅ Admin panel komple
- ✅ SDK ve test console hazır
- ✅ Docker setup çalışır durumda
- ✅ Dokümantasyon eksiksiz
- ✅ Test senaryoları hazır

**İlk adım:** `docker-compose up -d` komutu ile sistemi başlatın!

**İyi testler! 🚀**
