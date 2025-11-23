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
  status: 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
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
  maxRetries?: number;
  timeout?: number;
}

/**
 * SDK Error Class with detailed error information
 */
export class PSPayError extends Error {
  public code: string;
  public statusCode?: number;
  public isNetworkError: boolean;
  public isRetryable: boolean;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    statusCode?: number,
    isNetworkError: boolean = false
  ) {
    super(message);
    this.name = 'PSPayError';
    this.code = code;
    this.statusCode = statusCode;
    this.isNetworkError = isNetworkError;
    this.isRetryable = this.determineRetryable();
  }

  private determineRetryable(): boolean {
    // Network errors are retryable
    if (this.isNetworkError) return true;

    // 5xx server errors are retryable
    if (this.statusCode && this.statusCode >= 500) return true;

    // 429 (Too Many Requests) is retryable
    if (this.statusCode === 429) return true;

    // 408 (Request Timeout) is retryable
    if (this.statusCode === 408) return true;

    return false;
  }
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export class PSPay {
  private apiKey: string;
  private apiUrl: string;
  private wsUrl: string;
  private socket: Socket | null = null;
  private retryConfig: RetryConfig;
  private timeout: number;

  constructor(config: PSPayConfig) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl || 'http://localhost:3000/api/v1';
    this.wsUrl = config.wsUrl || 'http://localhost:3000';
    this.timeout = config.timeout || 30000; // 30 seconds default

    // Retry configuration with exponential backoff
    this.retryConfig = {
      maxRetries: config.maxRetries || 3,
      initialDelay: 1000, // 1 second
      maxDelay: 10000, // 10 seconds
      backoffMultiplier: 2,
    };
  }

  /**
   * HTTP fetch with timeout and retry logic
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retryCount: number = 0
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);

      // Check if it's a timeout or network error
      const isNetworkError = error.name === 'AbortError' || error.name === 'TypeError';

      // If max retries reached, throw error
      if (retryCount >= this.retryConfig.maxRetries) {
        throw new PSPayError(
          isNetworkError
            ? 'Ağ bağlantısı kurulamadı. Lütfen internet bağlantınızı kontrol edin.'
            : error.message,
          isNetworkError ? 'NETWORK_ERROR' : 'REQUEST_FAILED',
          undefined,
          isNetworkError
        );
      }

      // Calculate exponential backoff delay
      const delay = Math.min(
        this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, retryCount),
        this.retryConfig.maxDelay
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Retry the request
      return this.fetchWithRetry(url, options, retryCount + 1);
    }
  }

  /**
   * Parse error response from API
   */
  private async parseErrorResponse(response: Response): Promise<PSPayError> {
    let errorMessage = 'Bir hata oluştu';
    let errorCode = 'API_ERROR';

    try {
      const data = await response.json();
      errorMessage = data.message || data.error || errorMessage;
      errorCode = data.code || errorCode;
    } catch {
      // If JSON parsing fails, use status text
      errorMessage = response.statusText || errorMessage;
    }

    return new PSPayError(errorMessage, errorCode, response.status, false);
  }

  /**
   * Create a new payment with retry logic
   */
  async createPayment(options: PaymentOptions): Promise<Payment> {
    try {
      const response = await this.fetchWithRetry(`${this.apiUrl}/payments`, {
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
        throw await this.parseErrorResponse(response);
      }

      return response.json();
    } catch (error: any) {
      if (error instanceof PSPayError) {
        throw error;
      }
      throw new PSPayError(
        error?.message || 'Ödeme oluşturulurken bir hata oluştu',
        'PAYMENT_CREATION_FAILED'
      );
    }
  }

  /**
   * Get payment status with retry logic
   */
  async getPayment(paymentId: string): Promise<Payment> {
    try {
      const response = await this.fetchWithRetry(`${this.apiUrl}/payments/${paymentId}`, {
        headers: {
          'X-Api-Key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw await this.parseErrorResponse(response);
      }

      return response.json();
    } catch (error: any) {
      if (error instanceof PSPayError) {
        throw error;
      }
      throw new PSPayError(
        error?.message || 'Ödeme bilgisi alınırken bir hata oluştu',
        'PAYMENT_FETCH_FAILED'
      );
    }
  }

  /**
   * Show payment widget (Stripe-like modal)
   */
  showWidget(paymentId: string): PaymentWidget {
    return new PaymentWidget(paymentId, this.apiUrl, this.wsUrl);
  }

  /**
   * Subscribe to payment updates via WebSocket with auto-reconnection
   */
  subscribeToPayment(
    paymentId: string,
    onUpdate: (payment: Partial<Payment>) => void,
    onError?: (error: PSPayError) => void
  ): () => void {
    if (!this.socket) {
      this.socket = io(`${this.wsUrl}/payment`, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      // Connection error handling
      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        onError?.(
          new PSPayError(
            'Gerçek zamanlı bağlantı kurulamadı. Sayfa yenilenecek...',
            'WS_CONNECTION_ERROR',
            undefined,
            true
          )
        );
      });

      this.socket.on('disconnect', (reason) => {
        console.warn('WebSocket disconnected:', reason);
        if (reason === 'io server disconnect') {
          // Server disconnected, try to reconnect
          this.socket?.connect();
        }
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('WebSocket reconnected after', attemptNumber, 'attempts');
        // Re-subscribe to payment
        this.socket?.emit('subscribe', { paymentId });
      });

      this.socket.on('reconnect_failed', () => {
        onError?.(
          new PSPayError(
            'Bağlantı kurulamadı. Lütfen sayfayı yenileyin.',
            'WS_RECONNECT_FAILED',
            undefined,
            true
          )
        );
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
 * Payment Widget - Stripe-like modal UI with error handling
 */
export class PaymentWidget {
  private paymentId: string;
  private apiUrl: string;
  private wsUrl: string;
  private container: HTMLElement | null = null;
  private socket: Socket | null = null;
  private payment: Payment | null = null;
  private timerInterval: any = null;
  private error: PSPayError | null = null;
  private isLoading: boolean = true;
  private retryCount: number = 0;
  private maxRetries: number = 3;

  constructor(paymentId: string, apiUrl: string, wsUrl: string) {
    this.paymentId = paymentId;
    this.apiUrl = apiUrl;
    this.wsUrl = wsUrl;
    this.init();
  }

  private async init() {
    this.isLoading = true;
    this.error = null;

    try {
      // Fetch payment data with retry
      await this.fetchPayment();

      // Create UI
      this.createUI();

      // Connect WebSocket
      this.connectWebSocket();

      // Start timer
      this.startTimer();
    } catch (error) {
      this.error = error instanceof PSPayError ? error : new PSPayError(
        'Ödeme bilgisi yüklenirken bir hata oluştu',
        'WIDGET_INIT_FAILED'
      );

      this.createUI();
    } finally {
      this.isLoading = false;
    }
  }

  private async fetchPayment() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(`${this.apiUrl}/payments/${this.paymentId}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = 'Ödeme bilgisi alınamadı';
        try {
          const data = await response.json();
          errorMessage = data.message || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        throw new PSPayError(errorMessage, 'PAYMENT_FETCH_FAILED', response.status);
      }

      this.payment = await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new PSPayError(
          'İstek zaman aşımına uğradı. Lütfen internet bağlantınızı kontrol edin.',
          'REQUEST_TIMEOUT',
          408,
          true
        );
      }

      throw error;
    }
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

    // Register retry handler globally
    (window as any)[`pspayRetry_${this.paymentId}`] = () => this.retry();
  }

  /**
   * Retry loading payment after error
   */
  private async retry() {
    this.retryCount++;
    this.isLoading = true;
    this.error = null;
    this.updateUI();

    // Wait a bit before retrying (exponential backoff)
    const delay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 5000);
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Retry initialization
    await this.init();
  }

  private renderContent(): string {
    // Show loading state
    if (this.isLoading) {
      return this.renderLoading();
    }

    // Show error state
    if (this.error) {
      return this.renderError(this.error);
    }

    // Show payment not found
    if (!this.payment) {
      return this.renderError(
        new PSPayError('Ödeme bilgisi bulunamadı', 'PAYMENT_NOT_FOUND', 404)
      );
    }

    // Show payment states
    if (this.payment.status === 'PROCESSING') {
      return this.renderProcessing();
    }

    if (this.payment.status === 'APPROVED') {
      return this.renderSuccess();
    }

    if (this.payment.status === 'REJECTED') {
      return this.renderRejected();
    }

    if (this.payment.status === 'EXPIRED') {
      return this.renderExpired();
    }

    return this.renderPending();
  }

  private renderLoading(): string {
    return `
      <div style="text-align: center; padding: 40px;">
        <div class="pspay-spinner" style="
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3B82F6;
          border-radius: 50%;
          width: 64px;
          height: 64px;
          animation: pspay-spin 1s linear infinite;
          margin: 0 auto 24px;
        "></div>
        <style>
          @keyframes pspay-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
        <h3 style="color: #666; font-size: 16px;">Ödeme bilgileri yükleniyor...</h3>
      </div>
    `;
  }

  private renderError(error: PSPayError): string {
    const canRetry = error.isRetryable && this.retryCount < this.maxRetries;

    return `
      <div style="text-align: center;">
        <div style="font-size: 64px; margin-bottom: 16px;">⚠️</div>
        <h2 style="font-size: 24px; font-weight: bold; margin-bottom: 8px; color: #DC2626;">
          Bir Hata Oluştu
        </h2>
        <p style="color: #666; margin-bottom: 24px;">
          ${error.message}
        </p>

        ${error.isNetworkError ? `
        <div style="
          background: #FEF3C7;
          color: #92400E;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 24px;
        ">
          <strong>İnternet bağlantınızı kontrol edin</strong><br/>
          Lütfen internet bağlantınızın aktif olduğundan emin olun.
        </div>
        ` : ''}

        <div style="display: flex; gap: 12px; justify-content: center;">
          ${canRetry ? `
          <button
            onclick="window.pspayRetry_${this.paymentId}()"
            style="
              padding: 12px 24px;
              background: #3B82F6;
              color: white;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-size: 16px;
              font-weight: 600;
            "
          >
            🔄 Tekrar Dene ${this.retryCount > 0 ? `(${this.retryCount}/${this.maxRetries})` : ''}
          </button>
          ` : ''}

          <button
            onclick="document.getElementById('pspay-overlay').remove()"
            style="
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
      </div>
    `;
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

  private renderProcessing(): string {
    return `
      <div style="text-align: center;">
        <div style="margin-bottom: 16px;">
          <div class="pspay-spinner" style="
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3B82F6;
            border-radius: 50%;
            width: 64px;
            height: 64px;
            animation: pspay-spin 1s linear infinite;
            margin: 0 auto;
          "></div>
          <style>
            @keyframes pspay-spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        </div>
        <h2 style="font-size: 24px; font-weight: bold; margin-bottom: 8px; color: #3B82F6;">
          İşleniyor...
        </h2>
        <p style="color: #666; margin-bottom: 24px;">
          Ödemeniz kontrol ediliyor. Lütfen bekleyin.
        </p>
        <div style="
          background: #DBEAFE;
          color: #1E40AF;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
        ">
          Bu işlem birkaç saniye sürebilir.
        </div>
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

  private renderRejected(): string {
    return `
      <div style="text-align: center;">
        <div style="font-size: 64px; margin-bottom: 16px;">❌</div>
        <h2 style="font-size: 24px; font-weight: bold; margin-bottom: 8px; color: #DC2626;">
          Ödeme Reddedildi
        </h2>
        <p style="color: #666; margin-bottom: 24px;">
          Ödemeniz sistem tarafından reddedildi. Lütfen yeni bir ödeme oluşturun.
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

  private renderExpired(): string {
    return `
      <div style="text-align: center;">
        <div style="font-size: 64px; margin-bottom: 16px;">⚠️</div>
        <h2 style="font-size: 24px; font-weight: bold; margin-bottom: 8px; color: #D97706;">
          Süre Doldu
        </h2>
        <p style="color: #666; margin-bottom: 24px;">
          Ödeme süresi doldu. Lütfen yeni bir ödeme oluşturun.
        </p>
        <button
          onclick="document.getElementById('pspay-overlay').remove()"
          style="
            padding: 12px 24px;
            background: #D97706;
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
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.socket?.emit('subscribe', { paymentId: this.paymentId });
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      // Show subtle notification but don't block the UI
      this.showConnectionWarning('Gerçek zamanlı bağlantı kurulamadı. Otomatik yeniden deneniyor...');
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('WebSocket disconnected:', reason);
      if (reason === 'io server disconnect') {
        this.socket?.connect();
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
      this.socket?.emit('subscribe', { paymentId: this.paymentId });
    });

    this.socket.on('reconnect_failed', () => {
      this.showConnectionWarning(
        'Gerçek zamanlı güncellemeler alınamıyor. Lütfen sayfayı yenileyin.'
      );
    });

    // Payment status updates
    this.socket.on('payment:updated', (data) => {
      this.payment = { ...this.payment, ...data };
      this.updateUI();
    });

    // Processing state (collateral locked, admin checking)
    this.socket.on('payment:processing', (data) => {
      if (this.payment) {
        this.payment.status = 'PROCESSING';
        this.updateUI();
      }
    });

    // Bank status changes
    this.socket.on('bank:status_changed', (data) => {
      console.log('Bank status changed:', data);
      // Could show a notification if bank becomes unavailable
    });

    this.socket.emit('subscribe', { paymentId: this.paymentId });
  }

  /**
   * Show connection warning overlay
   */
  private showConnectionWarning(message: string) {
    const existingWarning = document.getElementById('pspay-connection-warning');
    if (existingWarning) {
      existingWarning.remove();
    }

    const warning = document.createElement('div');
    warning.id = 'pspay-connection-warning';
    warning.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #FEF3C7;
      color: #92400E;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      max-width: 90%;
      text-align: center;
    `;
    warning.textContent = message;

    document.body.appendChild(warning);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      warning.remove();
    }, 5000);
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

    // Remove connection warning if exists
    const warning = document.getElementById('pspay-connection-warning');
    if (warning) {
      warning.remove();
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    // Clean up retry handler
    delete (window as any)[`pspayRetry_${this.paymentId}`];
  }
}

export default PSPay;
