-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PSP_ADMIN', 'BANK_OWNER', 'PLATFORM_ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'WAITING_BANK_OWNER_APPROVAL', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LockStatus" AS ENUM ('ACTIVE', 'RELEASED', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "platform_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platforms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "webhook_url" TEXT,
    "webhook_secret" TEXT,
    "commission_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.015,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "collateral_limit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "used_collateral" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "available_collateral" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "owner_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_suspended" BOOLEAN NOT NULL DEFAULT false,
    "api_enabled" BOOLEAN NOT NULL DEFAULT false,
    "api_config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "transaction_code" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "bank_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "customer_email" TEXT,
    "customer_phone" TEXT,
    "customer_name" TEXT,
    "customer_ip" TEXT,
    "metadata" JSONB,
    "platform_order_id" TEXT,
    "platform_commission" DECIMAL(12,2),
    "psp_commission" DECIMAL(12,2),
    "net_amount" DECIMAL(12,2),
    "customer_confirmed_at" TIMESTAMP(3),
    "approval_deadline" TIMESTAMP(3),
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approval_notes" TEXT,
    "rejected_by_id" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "admin_notes" TEXT,
    "fraud_score" INTEGER DEFAULT 0,
    "risk_level" TEXT DEFAULT 'LOW',
    "fraud_rules" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "lock_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "transaction_id" TEXT,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'PENDING',
    "response_code" INTEGER,
    "response_body" TEXT,
    "error_message" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collateral_locks" (
    "id" TEXT NOT NULL,
    "bank_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "locked_amount" DECIMAL(12,2) NOT NULL,
    "locked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "released_at" TIMESTAMP(3),
    "status" "LockStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collateral_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "platform_id" TEXT,
    "transaction_id" TEXT,
    "ip_address" TEXT,
    "customer_email" TEXT,
    "customer_phone" TEXT,
    "risk_level" TEXT,
    "data" JSONB,
    "metadata" JSONB,
    "admin_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_api_key_key" ON "platforms"("api_key");

-- CreateIndex
CREATE UNIQUE INDEX "banks_code_key" ON "banks"("code");

-- CreateIndex
CREATE INDEX "banks_is_active_is_suspended_available_collateral_idx" ON "banks"("is_active", "is_suspended", "available_collateral");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_transaction_code_key" ON "transactions"("transaction_code");

-- CreateIndex
CREATE INDEX "transactions_transaction_code_idx" ON "transactions"("transaction_code");

-- CreateIndex
CREATE INDEX "transactions_platform_id_status_idx" ON "transactions"("platform_id", "status");

-- CreateIndex
CREATE INDEX "transactions_status_expires_at_idx" ON "transactions"("status", "expires_at");

-- CreateIndex
CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at");

-- CreateIndex
CREATE INDEX "transactions_customer_email_idx" ON "transactions"("customer_email");

-- CreateIndex
CREATE INDEX "transactions_customer_phone_idx" ON "transactions"("customer_phone");

-- CreateIndex
CREATE INDEX "transactions_customer_ip_idx" ON "transactions"("customer_ip");

-- CreateIndex
CREATE INDEX "payment_events_transaction_id_created_at_idx" ON "payment_events"("transaction_id", "created_at");

-- CreateIndex
CREATE INDEX "webhook_logs_platform_id_status_idx" ON "webhook_logs"("platform_id", "status");

-- CreateIndex
CREATE INDEX "webhook_logs_next_retry_at_idx" ON "webhook_logs"("next_retry_at");

-- CreateIndex
CREATE UNIQUE INDEX "collateral_locks_transaction_id_key" ON "collateral_locks"("transaction_id");

-- CreateIndex
CREATE INDEX "collateral_locks_bank_id_status_idx" ON "collateral_locks"("bank_id", "status");

-- CreateIndex
CREATE INDEX "collateral_locks_status_expires_at_idx" ON "collateral_locks"("status", "expires_at");

-- CreateIndex
CREATE INDEX "collateral_locks_transaction_id_idx" ON "collateral_locks"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE INDEX "security_events_event_type_created_at_idx" ON "security_events"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "security_events_platform_id_created_at_idx" ON "security_events"("platform_id", "created_at");

-- CreateIndex
CREATE INDEX "security_events_ip_address_idx" ON "security_events"("ip_address");

-- CreateIndex
CREATE INDEX "security_events_customer_email_idx" ON "security_events"("customer_email");

-- CreateIndex
CREATE INDEX "security_events_risk_level_created_at_idx" ON "security_events"("risk_level", "created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banks" ADD CONSTRAINT "banks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_rejected_by_id_fkey" FOREIGN KEY ("rejected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collateral_locks" ADD CONSTRAINT "collateral_locks_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collateral_locks" ADD CONSTRAINT "collateral_locks_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
