# SDK Test Console - User Guide

## Opening the Test Console

### Option 1: Direct File (Recommended)
1. Navigate to `sdk-test/` folder
2. Double-click `index.html`
3. Opens in your default browser

### Option 2: Simple HTTP Server
```bash
cd sdk-test
python3 -m http.server 8080
```
Then open: http://localhost:8080

### Option 3: Live Server (VS Code)
- Install "Live Server" extension
- Right-click `index.html` → "Open with Live Server"

---

## 🎯 Complete Test Workflow

### Scenario: Customer Pays 500 TRY, Bank Owner Approves

#### 1. Create Payment (Panel 1)
```
Amount: 500
Email: ali@example.com
Name: Ali Veli
Phone: +905551234567
```
- Click "Create Payment"
- **Copy the Transaction ID** from response

#### 2. Customer Confirms (Panel 2)
- Paste Transaction ID
- Click "Confirm Payment"
- **Watch countdown start: 5:00**

#### 3. Bank Owner Logs In (Panel 4)
```
Email: owner@bank.local
Password: owner123456
```
- Click "Login"
- **JWT token saved automatically**

#### 4. View Dashboard (Panel 5)
- Click "Get Dashboard"
- See:
  - Total collateral: 150,000 TRY
  - Available: 149,500 TRY (500 locked)
  - Pending transactions: 1
  - Time remaining: ~4:30

#### 5. Approve Payment (Panel 6)
- Transaction ID auto-filled
- Add notes: "Para hesaba geldi"
- Click "✅ Approve"
- **Countdown stops**
- Status: APPROVED
- Collateral released: 150,000 TRY available

#### 6. WebSocket Real-time (Panel 7)
- Click "Connect WebSocket"
- Create new payment
- Confirm it
- **See real-time notifications:**
  - 🔔 New payment awaiting approval
  - 📊 Dashboard updated
  - 💰 Collateral updated
  - ⏰ Countdown updates (every second)

---

## 🔍 Panel Descriptions

### Panel 1: Payment Creation
**Purpose:** Platform creates payment for customer

**Fields:**
- API Key: Platform authentication
- Amount: Payment amount in TRY
- Customer details: Email, name, phone

**Response:**
- Transaction ID
- Transaction code (PAY123456)
- Bank details (IBAN, account holder, reference)
- Expiry time (30 minutes)

---

### Panel 2: Customer Confirmation
**Purpose:** Customer clicks "I've made the payment" after bank transfer

**Fields:**
- Transaction ID: From Panel 1

**Response:**
- Status: WAITING_BANK_OWNER_APPROVAL
- Approval deadline: Current time + 5 minutes
- Countdown: Real-time 5-minute timer

**What Happens:**
1. Status changes from PENDING to WAITING_BANK_OWNER_APPROVAL
2. 5-minute countdown starts
3. Bank owner receives WebSocket notification
4. If no action in 5 min → Auto-reject

---

### Panel 3: Payment Status
**Purpose:** Check current payment status

**Features:**
- Manual check: Click "Check Status"
- Auto-refresh: Updates every 5 seconds
- Shows: status, time remaining, approval/rejection details

**Statuses:**
- PENDING: Payment created, waiting for customer
- WAITING_BANK_OWNER_APPROVAL: Customer confirmed, waiting for bank owner
- APPROVED: Bank owner approved
- REJECTED: Bank owner rejected or timeout
- EXPIRED: 30-minute payment window expired

---

### Panel 4: Bank Owner Login
**Purpose:** Authenticate bank owner

**Credentials:**
```
Email: owner@bank.local
Password: owner123456
```

**Response:**
- JWT access token (saved automatically)
- User details
- Token valid for 7 days

---

### Panel 5: Bank Owner Dashboard
**Purpose:** View all accounts and pending transactions

**Features:**
- View all bank accounts
- Real-time collateral status
- Pending approval count
- WebSocket connection status

**Dashboard Data:**
```json
{
  "owner": {
    "name": "Ahmet Bank Owner",
    "total_accounts": 2,
    "total_collateral": 150000,
    "total_locked": 500,
    "total_available": 149500
  },
  "accounts": [
    {
      "bank_name": "Garanti Bankası",
      "collateral_total": 100000,
      "collateral_locked": 500,
      "collateral_available": 99500
    }
  ],
  "pending_transactions": [
    {
      "id": "tx_123",
      "amount": 500,
      "customer_email": "ali@example.com",
      "time_remaining": 290
    }
  ]
}
```

---

### Panel 6: Bank Owner Approval
**Purpose:** Approve or reject payment

**Approve:**
- Add notes (optional): "Para hesaba geldi"
- Click "✅ Approve"
- Collateral released
- Customer notified
- Platform webhook sent

**Reject:**
- Click "❌ Reject"
- Enter reason: "Para hesaba gelmedi"
- Collateral released
- Customer notified

---

### Panel 7: WebSocket Logs
**Purpose:** Real-time event monitoring

**Events:**
- `payment:awaiting-approval` - New payment needs approval
- `dashboard:update` - Dashboard data changed
- `collateral:update` - Collateral amounts changed
- `countdown:update` - Per-second countdown updates

**Features:**
- Auto-scroll to latest
- Keeps last 50 events
- Clear logs button
- Timestamp for each event

---

## 🧪 Test Scenarios

### Scenario 1: Happy Path ✅
1. Create payment → Status: PENDING
2. Confirm payment → Countdown starts
3. Login as bank owner
4. Approve payment → Success

### Scenario 2: Timeout ⏰
1. Create payment
2. Confirm payment
3. Wait 5 minutes (or skip)
4. Auto-reject due to timeout

### Scenario 3: Rejection ❌
1. Create payment
2. Confirm payment
3. Login as bank owner
4. Reject with reason
5. Check status → REJECTED

### Scenario 4: Real-time Updates 📡
1. Connect WebSocket
2. Create payment
3. Confirm payment
4. Watch logs for events
5. Approve → See instant notification

### Scenario 5: Multiple Payments 🔄
1. Create 3 payments
2. Confirm all 3
3. View dashboard → See all 3 pending
4. Approve them one by one
5. Watch collateral change in real-time

---

## 🐛 Common Issues

### "Network error" on create payment
- **Fix:** Check if backend is running (http://localhost:3000/api/v1/health)
- **Command:** `docker-compose ps`

### "Transaction not found"
- **Fix:** Copy exact Transaction ID from Panel 1 response
- **Tip:** Use auto-fill feature

### "JWT token required"
- **Fix:** Login first in Panel 4
- **Check:** Look for success message

### WebSocket not connecting
- **Fix:** Check if backend is running
- **URL:** ws://localhost:3000/bank-owner
- **Browser:** Open DevTools → Console for errors

### Countdown shows "NaN:NaN"
- **Fix:** Refresh page
- **Cause:** Invalid time remaining from server

---

## 💡 Tips & Tricks

1. **Auto-fill:** Transaction ID auto-fills across panels when you create payment

2. **Auto-refresh:** Use in Panel 3 to watch status changes

3. **WebSocket:** Keep connected to see all events in real-time

4. **DevTools:** Open browser console (F12) to see detailed logs

5. **Postman:** Export requests for automation

6. **Multiple Browsers:** Test customer and bank owner in separate windows

---

## 🎨 Color Codes

- 🟢 **Green Box:** Success response
- 🔴 **Red Box:** Error response
- 🟡 **Yellow Box:** Warning/Info
- ⚪ **Gray Box:** Default response
- 🔵 **Blue Dot:** WebSocket connected
- 🔴 **Red Dot:** WebSocket disconnected

---

## 📊 Expected Response Times

| Operation | Time | Notes |
|-----------|------|-------|
| Create Payment | < 200ms | Includes fraud check |
| Confirm Payment | < 100ms | Sets countdown |
| Check Status | < 50ms | Database query |
| Login | < 150ms | BCrypt verification |
| Get Dashboard | < 100ms | Complex join query |
| Approve/Reject | < 150ms | Releases collateral |
| WebSocket Event | < 50ms | Real-time notification |

---

## 🚀 Next Steps

1. **Try edge cases:** Invalid IDs, expired payments, duplicate confirms
2. **Monitor logs:** `docker-compose logs -f backend`
3. **Check database:** `npx prisma studio`
4. **Build SDK:** Create TypeScript/JavaScript wrapper
5. **Load test:** Use k6 or Artillery

---

**Need Help?** Open browser console (F12) for detailed error messages!
