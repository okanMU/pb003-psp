# PSP Backend API

NestJS + PostgreSQL + Redis + WebSocket

## Kurulum

```bash
# Dependencies
npm install

# Environment
cp .env.example .env
# Edit .env with your database credentials

# Database setup
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed

# Development
npm run dev
```

## API Endpoints

### Public API (SDK kullanır)
- `POST /api/v1/payments` - Create payment
- `GET /api/v1/payments/:id` - Get payment status
- `GET /api/v1/payments/code/:code` - Get by ref code

### Admin API
- `GET /api/v1/admin/dashboard/stats` - Dashboard stats
- `GET /api/v1/admin/payments/pending` - Pending payments (grouped by bank)
- `POST /api/v1/admin/payments/:id/approve` - Approve payment
- `POST /api/v1/admin/payments/:id/reject` - Reject payment
- `POST /api/v1/admin/payments/batch-approve` - Batch approve
- `GET /api/v1/admin/search/ref-code/:code` - Search by ref code

## WebSocket Namespaces

### `/payment` (Customer side)
- `subscribe` - Subscribe to payment updates
- `unsubscribe` - Unsubscribe
- Events: `payment:status`, `payment:updated`, `timer:update`

### `/admin` (Admin panel)
- Auto-connect on admin panel
- Events: `notification`, `dashboard:stats`, `dashboard:update`

## Tech Stack
- NestJS 10
- PostgreSQL + Prisma
- Redis (pub/sub + cache)
- Socket.io (WebSocket)
- Bull (job queue)
