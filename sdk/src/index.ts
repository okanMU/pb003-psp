import { io, Socket } from 'socket.io-client';

export interface PaymentOptions {
  amount: number;
  currency?: string;
  customer?: {
    email?: string;
    phone?: string;
    name?: string;
  };
  metadata?: Record<string, any>;
  platformOrderId?: string;
}

export interface Payment {
  id: string;
  code: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  bank: {
    name: string;
    iban: string;
    account_name: string;
  };
  customer: {
    email?: string;
    phone?: string;
    name?: string;
  };
  expires_at: string;
  created_at: string;
}

export interface PSPayConfig {
  apiKey: string;
  apiUrl?: string;
  wsUrl?: string;
}

export class PSPay {
  private apiKey: string;
  private apiUrl: string;
  private wsUrl: string;
  private socket: Socket | null = null;

  constructor(config: PSPayConfig) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl || 'http://localhost:3000/api/v1';
    this.wsUrl = config.wsUrl || 'http://localhost:3000';
  }

  /**
   * Create a new payment
   */
  async createPayment(options: PaymentOptions): Promise<Payment> {
    const response = await fetch(`${this.apiUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
      },
      body: JSON.stringify({
        amount: options.amount,
        currency: options.currency || 'TRY',
        customer_email: options.customer?.email,
        customer_phone: options.customer?.phone,
        customer_name: options.customer?.name,
        metadata: options.metadata,
        platform_order_id: options.platformOrderId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Payment creation failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get payment status
   */
  async getPayment(paymentId: string): Promise<Payment> {
    const response = await fetch(`${this.apiUrl}/payments/${paymentId}`, {
      headers: {
        'X-Api-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch payment: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Show payment widget (Stripe-like modal)
   */
  showWidget(paymentId: string): PaymentWidget {
    return new PaymentWidget(paymentId, this.apiUrl, this.wsUrl);
  }

  /**
   * Subscribe to payment updates via WebSocket
   */
  subscribeToPayment(
    paymentId: string,
    onUpdate: (payment: Partial<Payment>) => void
  ): () => void {
    if (!this.socket) {
      this.socket = io(`${this.wsUrl}/payment`, {
        transports: ['websocket'],
      });
    }

    this.socket.emit('subscribe', { paymentId });

    this.socket.on('payment:status', onUpdate);
    this.socket.on('payment:updated', onUpdate);

    // Return unsubscribe function
    return () => {
      this.socket?.emit('unsubscribe', { paymentId });
      this.socket?.off('payment:status', onUpdate);
      this.socket?.off('payment:updated', onUpdate);
    };
  }
}

/**
 * Payment Widget - Stripe-like modal UI
 */
export class PaymentWidget {
  private paymentId: string;
  private apiUrl: string;
  private wsUrl: string;
  private container: HTMLElement | null = null;
  private socket: Socket | null = null;
  private payment: Payment | null = null;
  private timerInterval: any = null;

  constructor(paymentId: string, apiUrl: string, wsUrl: string) {
    this.paymentId = paymentId;
    this.apiUrl = apiUrl;
    this.wsUrl = wsUrl;
    this.init();
  }

  private async init() {
    // Fetch payment data
    await this.fetchPayment();

    // Create UI
    this.createUI();

    // Connect WebSocket
    this.connectWebSocket();

    // Start timer
    this.startTimer();
  }

  private async fetchPayment() {
    const response = await fetch(`${this.apiUrl}/payments/${this.paymentId}`);
    this.payment = await response.json();
  }

  private createUI() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'pspay-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;

    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 32px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    `;

    modal.innerHTML = `
      <div id="pspay-content">
        ${this.renderContent()}
      </div>
    `;

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
      }
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    this.container = modal;
  }

  private renderContent(): string {
    if (!this.payment) return '<div>Loading...</div>';

    if (this.payment.status === 'APPROVED') {
      return this.renderSuccess();
    }

    if (this.payment.status === 'REJECTED' || this.payment.status === 'EXPIRED') {
      return this.renderError();
    }

    return this.renderPending();
  }

  private renderPending(): string {
    return `
      <div style="text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">💳</div>
        <h2 style="font-size: 24px; font-weight: bold; margin-bottom: 8px;">
          Ödeme Bekliyor
        </h2>
        <p style="color: #666; margin-bottom: 24px;">
          Ref Kod: <strong style="font-family: monospace; font-size: 20px;">${this.payment?.code}</strong>
        </p>

        <div id="pspay-timer" style="
          background: #FEF3C7;
          color: #92400E;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 24px;
          font-size: 18px;
          font-weight: bold;
        ">
          Süre: <span id="pspay-countdown">--:--</span>
        </div>

        <div style="
          background: #F3F4F6;
          padding: 20px;
          border-radius: 8px;
          text-align: left;
          margin-bottom: 24px;
        ">
          <h3 style="font-weight: 600; margin-bottom: 12px;">Banka Bilgileri:</h3>
          <div style="margin-bottom: 8px;">
            <strong>${this.payment?.bank.name}</strong>
          </div>
          <div style="font-family: monospace; font-size: 14px; margin-bottom: 8px;">
            IBAN: ${this.payment?.bank.iban}
          </div>
          <div style="font-size: 14px; margin-bottom: 8px;">
            Alıcı: ${this.payment?.bank.account_name}
          </div>
          <div style="font-size: 14px; margin-top: 12px;">
            Tutar: <strong style="font-size: 20px;">${this.payment?.amount} TRY</strong>
          </div>
        </div>

        <div style="
          background: #DBEAFE;
          color: #1E40AF;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
        ">
          <strong>Önemli:</strong> Havale yaparken açıklama kısmına
          <strong>${this.payment?.code}</strong> kodunu yazınız.
        </div>

        <button
          onclick="document.getElementById('pspay-overlay').remove()"
          style="
            margin-top: 24px;
            padding: 12px 24px;
            background: #6B7280;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
          "
        >
          Kapat
        </button>
      </div>
    `;
  }

  private renderSuccess(): string {
    return `
      <div style="text-align: center;">
        <div style="font-size: 64px; margin-bottom: 16px;">✅</div>
        <h2 style="font-size: 24px; font-weight: bold; margin-bottom: 8px; color: #059669;">
          Ödeme Onaylandı!
        </h2>
        <p style="color: #666; margin-bottom: 24px;">
          Ödemeniz başarıyla alındı.
        </p>
        <button
          onclick="document.getElementById('pspay-overlay').remove()"
          style="
            padding: 12px 24px;
            background: #059669;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
          "
        >
          Tamam
        </button>
      </div>
    `;
  }

  private renderError(): string {
    return `
      <div style="text-align: center;">
        <div style="font-size: 64px; margin-bottom: 16px;">❌</div>
        <h2 style="font-size: 24px; font-weight: bold; margin-bottom: 8px; color: #DC2626;">
          ${this.payment?.status === 'REJECTED' ? 'Ödeme Reddedildi' : 'Süre Doldu'}
        </h2>
        <p style="color: #666; margin-bottom: 24px;">
          Lütfen yeni bir ödeme oluşturun.
        </p>
        <button
          onclick="document.getElementById('pspay-overlay').remove()"
          style="
            padding: 12px 24px;
            background: #DC2626;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
          "
        >
          Kapat
        </button>
      </div>
    `;
  }

  private connectWebSocket() {
    this.socket = io(`${this.wsUrl}/payment`, {
      transports: ['websocket'],
    });

    this.socket.emit('subscribe', { paymentId: this.paymentId });

    this.socket.on('payment:updated', (data) => {
      this.payment = { ...this.payment, ...data };
      this.updateUI();
    });
  }

  private startTimer() {
    this.timerInterval = setInterval(() => {
      this.updateCountdown();
    }, 1000);
  }

  private updateCountdown() {
    if (!this.payment) return;

    const now = new Date().getTime();
    const expires = new Date(this.payment.expires_at).getTime();
    const diff = expires - now;

    if (diff <= 0) {
      const el = document.getElementById('pspay-countdown');
      if (el) el.textContent = '00:00';
      clearInterval(this.timerInterval);
      return;
    }

    const minutes = Math.floor(diff / 1000 / 60);
    const seconds = Math.floor((diff / 1000) % 60);

    const el = document.getElementById('pspay-countdown');
    if (el) {
      el.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  }

  private updateUI() {
    const content = document.getElementById('pspay-content');
    if (content) {
      content.innerHTML = this.renderContent();
    }
  }

  close() {
    const overlay = document.getElementById('pspay-overlay');
    if (overlay) {
      overlay.remove();
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }
}

export default PSPay;
