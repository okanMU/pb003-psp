# PSPay SDK

Stripe-like payment integration SDK for PSP system.

## Installation

```bash
npm install @pspay/sdk
```

## Usage

### Basic Example

```javascript
import PSPay from '@pspay/sdk';

// Initialize
const pspay = new PSPay({
  apiKey: 'your_api_key',
});

// Create payment
const payment = await pspay.createPayment({
  amount: 1500,
  currency: 'TRY',
  customer: {
    email: 'customer@example.com',
    phone: '+905551234567',
    name: 'John Doe',
  },
  metadata: {
    orderId: 'ORDER-123',
  },
});

// Show widget (Stripe-like modal)
pspay.showWidget(payment.id);
```

### React Example

```jsx
import { useState } from 'react';
import PSPay from '@pspay/sdk';

const pspay = new PSPay({ apiKey: 'your_api_key' });

function CheckoutButton() {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);

    try {
      const payment = await pspay.createPayment({
        amount: 1500,
        customer: {
          email: 'user@example.com',
        },
      });

      pspay.showWidget(payment.id);
    } catch (error) {
      console.error('Payment error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleCheckout} disabled={loading}>
      {loading ? 'Loading...' : 'Pay Now'}
    </button>
  );
}
```

### Real-time Updates

```javascript
// Subscribe to payment updates
const unsubscribe = pspay.subscribeToPayment(
  paymentId,
  (update) => {
    console.log('Payment updated:', update);

    if (update.status === 'APPROVED') {
      console.log('Payment approved!');
      // Redirect to success page
    }
  }
);

// Later, unsubscribe
unsubscribe();
```

### Check Payment Status

```javascript
const payment = await pspay.getPayment(paymentId);

console.log(payment.status); // PENDING, APPROVED, REJECTED, EXPIRED
console.log(payment.code);   // PAY123456
console.log(payment.bank);   // Bank details
```

## API Reference

### `PSPay`

#### Constructor

```typescript
new PSPay(config: PSPayConfig)
```

**Config:**
- `apiKey` (required): Your API key
- `apiUrl` (optional): API endpoint (default: production URL)
- `wsUrl` (optional): WebSocket endpoint

#### Methods

##### `createPayment(options: PaymentOptions): Promise<Payment>`

Create a new payment.

**Options:**
- `amount` (required): Payment amount
- `currency` (optional): Currency code (default: 'TRY')
- `customer` (optional): Customer information
  - `email` (optional)
  - `phone` (optional)
  - `name` (optional)
- `metadata` (optional): Custom metadata object
- `platformOrderId` (optional): Your internal order ID

##### `getPayment(paymentId: string): Promise<Payment>`

Get payment details and status.

##### `showWidget(paymentId: string): PaymentWidget`

Show payment widget (Stripe-like modal).

##### `subscribeToPayment(paymentId: string, callback: Function): () => void`

Subscribe to real-time payment updates. Returns unsubscribe function.

## Payment Flow

1. Customer initiates payment
2. SDK creates payment via API
3. Modal shows bank details + ref code
4. Customer makes bank transfer
5. Admin approves payment (manual check)
6. Customer receives real-time notification
7. Platform receives webhook

## Webhook Integration

Set up webhook endpoint in platform settings:

```javascript
// Express example
app.post('/webhooks/psp', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = req.body;

  // Verify signature
  if (!verifySignature(payload, signature, webhookSecret)) {
    return res.status(401).send('Invalid signature');
  }

  // Handle events
  switch (payload.event) {
    case 'payment.approved':
      // Update order status
      break;
    case 'payment.rejected':
      // Handle rejection
      break;
  }

  res.send('OK');
});
```

## Demo

```bash
cd sdk
npm install
npm run build
npm run demo
```

Visit http://localhost:3000

## License

MIT
