import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create PSP Admin
  const adminPassword = await bcrypt.hash('admin123456', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@psp.local' },
    update: {},
    create: {
      email: 'admin@psp.local',
      password_hash: adminPassword,
      name: 'PSP Administrator',
      role: 'PSP_ADMIN',
      is_active: true,
    },
  });
  console.log('✅ Created PSP Admin:', admin.email);

  // Create Test Platform
  const platform = await prisma.platform.upsert({
    where: { api_key: 'test_platform_api_key_12345' },
    update: {},
    create: {
      name: 'Test E-Commerce Platform',
      api_key: 'test_platform_api_key_12345',
      webhook_url: 'http://localhost:8080/webhook',
      webhook_secret: 'test_webhook_secret_67890',
      commission_rate: 0.015, // 1.5%
      is_active: true,
    },
  });
  console.log('✅ Created Test Platform:', platform.name);

  // Create Bank Owner
  const ownerPassword = await bcrypt.hash('owner123456', 10);
  const bankOwner = await prisma.user.upsert({
    where: { email: 'owner@bank.local' },
    update: {},
    create: {
      email: 'owner@bank.local',
      password_hash: ownerPassword,
      name: 'Ahmet Bank Owner',
      role: 'BANK_OWNER',
      is_active: true,
    },
  });
  console.log('✅ Created Bank Owner:', bankOwner.email);

  // Create Test Bank Account
  const bank = await prisma.bank.upsert({
    where: { code: 'GARANTI_TEST' },
    update: {},
    create: {
      name: 'Garanti Bankası Test Hesabı',
      code: 'GARANTI_TEST',
      iban: 'TR330006100519786457841326',
      account_name: 'PSP Teminat Hesabı',
      collateral_limit: 100000, // 100,000 TRY
      used_collateral: 0,
      available_collateral: 100000,
      owner_id: bankOwner.id,
      is_active: true,
      is_suspended: false,
      api_enabled: false,
    },
  });
  console.log('✅ Created Test Bank:', bank.name);

  // Create Second Bank Account
  const bank2 = await prisma.bank.upsert({
    where: { code: 'ISBANK_TEST' },
    update: {},
    create: {
      name: 'İş Bankası Test Hesabı',
      code: 'ISBANK_TEST',
      iban: 'TR640006400000111222333444',
      account_name: 'PSP Teminat Hesabı 2',
      collateral_limit: 50000, // 50,000 TRY
      used_collateral: 0,
      available_collateral: 50000,
      owner_id: bankOwner.id,
      is_active: true,
      is_suspended: false,
      api_enabled: false,
    },
  });
  console.log('✅ Created Second Bank:', bank2.name);

  console.log('');
  console.log('🎉 Seeding completed!');
  console.log('');
  console.log('📝 Test Credentials:');
  console.log('====================================');
  console.log('PSP Admin:');
  console.log('  Email: admin@psp.local');
  console.log('  Password: admin123456');
  console.log('');
  console.log('Bank Owner:');
  console.log('  Email: owner@bank.local');
  console.log('  Password: owner123456');
  console.log('');
  console.log('Platform API:');
  console.log('  API Key: test_platform_api_key_12345');
  console.log('====================================');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
