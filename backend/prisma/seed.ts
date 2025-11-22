import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@psp.local' },
    update: {},
    create: {
      email: 'admin@psp.local',
      password_hash: adminPassword,
      name: 'Admin User',
      role: 'SUPER_ADMIN',
    },
  });

  console.log('✅ Admin user created:', admin.email);

  // Test Platform
  const platform = await prisma.platform.upsert({
    where: { api_key: 'pk_test_demo_platform' },
    update: {},
    create: {
      name: 'Demo E-Commerce',
      api_key: 'pk_test_demo_platform',
      webhook_url: 'https://webhook.site/unique-id', // Test için
      webhook_secret: 'whsec_test_secret',
      commission_rate: 0.015, // 1.5%
    },
  });

  console.log('✅ Platform created:', platform.name);

  // Bankalar
  const banks = [
    {
      name: 'Garanti BBVA',
      code: 'GARANTI',
      iban: 'TR330006100519786457841326',
      account_name: 'PSP ÖDEME HİZMETLERİ A.Ş.',
    },
    {
      name: 'İş Bankası',
      code: 'ISBANK',
      iban: 'TR640006400000111222333444',
      account_name: 'PSP ÖDEME HİZMETLERİ A.Ş.',
    },
    {
      name: 'Akbank',
      code: 'AKBANK',
      iban: 'TR120004600123456789012345',
      account_name: 'PSP ÖDEME HİZMETLERİ A.Ş.',
    },
  ];

  for (const bank of banks) {
    await prisma.bank.upsert({
      where: { code: bank.code },
      update: {},
      create: bank,
    });
    console.log(`✅ Bank created: ${bank.name}`);
  }

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
