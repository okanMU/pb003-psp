# PSP MVP - Payment Service Provider PoC

3 bacaklı ödeme sistemi: Backend API, Admin Panel ve Integration SDK

## Proje Yapısı

```
pb003-psp/
├── backend/          # NestJS API + WebSocket + PostgreSQL + Redis
├── admin-panel/      # React Admin Dashboard (Real-time)
├── sdk/              # Integration SDK + Payment Widget
└── docs/             # Documentation & Examples
```

## Özellikler

### Backend
- ✅ RESTful API (NestJS)
- ✅ WebSocket real-time events
- ✅ PostgreSQL + Prisma ORM
- ✅ Redis (caching + pub/sub)
- ✅ Ref kod sistemi
- ✅ Manuel banka kontrolü
- ✅ Webhook delivery
- ✅ Komisyon hesaplama
- ✅ JWT Authentication

### Admin Panel
- ✅ Real-time dashboard
- ✅ Manuel ödeme kontrolü
- ✅ Banka yönetimi
- ✅ Canlı bildirimler
- ✅ İstatistikler ve grafikler
- ✅ Toplu onaylama

### Integration SDK
- ✅ JavaScript/TypeScript SDK
- ✅ Payment Widget (Stripe-like)
- ✅ Webhook helpers
- ✅ React component
- ✅ Vanilla JS support

## Hızlı Başlangıç

### 1. Backend
```bash
cd backend
npm install
npm run prisma:migrate
npm run dev
```

### 2. Admin Panel
```bash
cd admin-panel
npm install
npm run dev
```

### 3. SDK Test
```bash
cd sdk
npm install
npm run build
npm run demo
```

## Kullanım Senaryoları

### Senaryo 1: E-ticaret Entegrasyonu
```javascript
import PSPay from '@pspay/sdk';

const pspay = new PSPay('pk_test_123');

// Ödeme oluştur
const payment = await pspay.createPayment({
  amount: 1500,
  currency: 'TRY',
  customer: {
    email: 'user@example.com',
    phone: '+905551234567'
  },
  metadata: {
    orderId: 'ORD-12345'
  }
});

// Widget göster
pspay.showWidget(payment.id);
```

### Senaryo 2: Admin Manuel Kontrol
1. Admin panelde bekleyen ödemeler görünür
2. Admin bankaya giriş yapar
3. Ref kodu ile havalayı kontrol eder
4. Onaylar veya reddeder
5. Platform otomatik webhook alır
6. Müşteri real-time bildirim alır

### Senaryo 3: Real-time Flow
```
Müşteri → SDK Widget → Backend API
                           ↓
                     [PENDING Payment]
                           ↓
                    WebSocket Emit
                     ↙           ↘
            Admin Panel      Customer Widget
            (notification)   (countdown timer)
                     ↓
              [Admin Approves]
                     ↓
              Webhook → Platform
                     ↓
            WebSocket → Customer
                     ↓
              [SUCCESS Screen]
```

## Teknoloji Stack

### Backend
- NestJS 10.x
- PostgreSQL 15
- Prisma ORM
- Redis 7.x
- Socket.io
- Bull (job queue)

### Admin Panel
- React 18
- Vite
- TailwindCSS
- Socket.io-client
- React Query
- Recharts

### SDK
- TypeScript
- Vanilla JS
- React wrapper
- Rollup (bundler)

## API Endpoints

### Public API
```
POST   /api/v1/payments          # Create payment
GET    /api/v1/payments/:id      # Get payment status
POST   /api/v1/webhooks/verify   # Verify webhook signature
```

### Admin API
```
GET    /api/v1/admin/dashboard/stats
GET    /api/v1/admin/payments/pending
POST   /api/v1/admin/payments/:id/approve
POST   /api/v1/admin/payments/:id/reject
POST   /api/v1/admin/payments/batch-approve
```

### WebSocket Events
```
// Client → Server
- payment:subscribe
- payment:unsubscribe

// Server → Client
- payment:created
- payment:pending
- payment:approved
- payment:rejected
- payment:expired
- admin:notification
- timer:update
```

## Environment Variables

### Backend
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/psp
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
WEBHOOK_SECRET=whsec_xxx
```

### Admin Panel
```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

### SDK
```env
PUBLIC_API_URL=http://localhost:3000
```

## Development

```bash
# Install all dependencies
npm run install:all

# Start all services
npm run dev:all

# Build all
npm run build:all

# Test
npm run test:all
```

## Deployment

### Backend (Railway/Render)
```bash
cd backend
npm run build
npm run start:prod
```

### Admin Panel (Vercel/Netlify)
```bash
cd admin-panel
npm run build
# Deploy dist/ folder
```

### SDK (npm publish)
```bash
cd sdk
npm run build
npm publish
```

## License

MIT
