# 🚀 PSP Payment System - Docker Quick Start Guide

## Prerequisites

- Docker Desktop installed
- Docker Compose installed
- 8GB RAM minimum
- Ports available: 3000, 5432, 6379

## Quick Start (3 Steps!)

### 1. Start the System

```bash
# Navigate to project directory
cd pb003-psp

# Start all services (PostgreSQL, Redis, Backend)
docker-compose up -d

# Check status
docker-compose ps
```

**Expected Output:**
```
NAME                IMAGE                    STATUS              PORTS
psp-backend         pb003-psp-backend        Up 30 seconds       0.0.0.0:3000->3000/tcp
psp-postgres        postgres:15-alpine       Up (healthy)        0.0.0.0:5432->5432/tcp
psp-redis           redis:7-alpine           Up (healthy)        0.0.0.0:6379->6379/tcp
```

### 2. Wait for Initialization (60 seconds)

The backend automatically:
- ✅ Generates Prisma Client
- ✅ Runs database migrations
- ✅ Seeds test data
- ✅ Starts NestJS server

**Check logs:**
```bash
docker-compose logs -f backend
```

**Look for:**
```
✅ Created PSP Admin: admin@psp.local
✅ Created Bank Owner: owner@bank.local
✅ Created Test Bank: Garanti Bankası Test Hesabı
🎉 Seeding completed!
```

### 3. Open Test Console

Open in browser: **http://localhost:8080** (or open `sdk-test/index.html` directly)

---

## 🧪 Test Workflow

### Test Scenario: Customer Deposits 500 TRY

**Step 1: Create Payment** (Panel 1)
- Click "Create Payment"
- Transaction ID auto-fills in other panels

**Step 2: Customer Confirms** (Panel 2)
- Click "Confirm Payment"
- See 5-minute countdown start

**Step 3: Bank Owner Login** (Panel 4)
```
Email: owner@bank.local
Password: owner123456
```

**Step 4: View Dashboard** (Panel 5)
- Click "Get Dashboard"
- See pending transaction with countdown

**Step 5: Approve Payment** (Panel 6)
- Click "✅ Approve"
- See status change to APPROVED
- Countdown stops

**Step 6: Real-time WebSocket** (Panel 7)
- Click "Connect WebSocket"
- See real-time events in logs

---

## 📊 System Status Commands

```bash
# View all logs
docker-compose logs -f

# View backend logs only
docker-compose logs -f backend

# Check database
docker-compose exec postgres psql -U psp_user -d psp_development -c "SELECT COUNT(*) FROM users;"

# Check Redis
docker-compose exec redis redis-cli ping

# Restart services
docker-compose restart

# Stop all services
docker-compose down

# Stop and remove all data
docker-compose down -v
```

---

## 🔧 Troubleshooting

### Problem: Backend fails to start

**Solution:**
```bash
# Check backend logs
docker-compose logs backend

# Rebuild backend
docker-compose up --build backend
```

### Problem: "Connection refused" errors

**Wait for services:**
```bash
# Check health
docker-compose ps

# All should be "Up (healthy)"
```

### Problem: Port already in use

**Change ports in docker-compose.yml:**
```yaml
backend:
  ports:
    - "3001:3000"  # Change 3000 to 3001
```

### Problem: Prisma migration fails

**Reset database:**
```bash
docker-compose down -v
docker-compose up -d
```

---

## 📝 Test Credentials

### Bank Owner
```
Email: owner@bank.local
Password: owner123456
```

### PSP Admin
```
Email: admin@psp.local
Password: admin123456
```

### Platform API
```
API Key: test_platform_api_key_12345
```

---

## 🌐 API Endpoints

**Base URL:** http://localhost:3000/api/v1

### Payment Endpoints (Public with API Key)
- POST `/payments` - Create payment
- POST `/payments/confirm/:id` - Customer confirms payment
- GET `/payments/status/:id` - Get payment status
- GET `/payments/:id` - Get payment by ID
- GET `/payments/code/:code` - Get payment by code

### Bank Owner Endpoints (JWT Required)
- POST `/auth/login` - Login
- GET `/bank-owner/dashboard` - Get dashboard
- GET `/bank-owner/account/:accountId` - Get account status
- POST `/bank-owner/approve-payment` - Approve payment
- POST `/bank-owner/reject-payment` - Reject payment

### WebSocket Namespaces
- `ws://localhost:3000/payment` - Customer updates
- `ws://localhost:3000/bank-owner` - Bank owner notifications
- `ws://localhost:3000/admin` - Admin dashboard

---

## 🎯 Next Steps

1. **Explore Prisma Studio:**
   ```bash
   cd backend
   npx prisma studio
   ```
   Open: http://localhost:5555

2. **Monitor Redis:**
   ```bash
   docker-compose exec redis redis-cli monitor
   ```

3. **Check Database:**
   ```bash
   docker-compose exec postgres psql -U psp_user -d psp_development
   ```

4. **View Swagger API Docs:**
   Open: http://localhost:3000/api

---

## 🐳 Docker Compose Services

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| backend | Custom (NestJS) | 3000 | REST API + WebSocket |
| postgres | postgres:15-alpine | 5432 | PostgreSQL Database |
| redis | redis:7-alpine | 6379 | Cache + Pub/Sub |

---

## 💡 Pro Tips

1. **Hot Reload:** Code changes auto-reload (volume mounted)
2. **Database Persist:** Data saved in Docker volumes
3. **Clean Start:** `docker-compose down -v && docker-compose up -d`
4. **Production Build:** Change Dockerfile target to `production`

---

## 🆘 Need Help?

- Check logs: `docker-compose logs -f backend`
- View database: `npx prisma studio`
- Test API: Use Postman or `curl`
- WebSocket test: Browser console or socket.io client

---

**Happy Testing! 🎉**
