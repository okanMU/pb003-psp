#!/bin/bash
# Database initialization script for PSP system

set -e

echo "🚀 PSP Database Initialization Started"
echo "======================================"

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
until pg_isready -h localhost -p 5432 -U psp_user; do
  sleep 2
done

echo "✅ PostgreSQL is ready!"

# Generate Prisma Client
echo "📦 Generating Prisma Client..."
npx prisma generate

# Run migrations
echo "🔄 Running database migrations..."
npx prisma migrate deploy

# Seed database (if seed script exists)
if [ -f "prisma/seed.ts" ]; then
  echo "🌱 Seeding database..."
  npx prisma db seed
else
  echo "⚠️  No seed script found, skipping seeding"
fi

echo "======================================"
echo "✅ Database initialization completed!"
echo ""
echo "📊 Database Status:"
npx prisma db execute --stdin <<EOF
SELECT
  'Users' as table_name,
  COUNT(*) as count
FROM users
UNION ALL
SELECT 'Platforms', COUNT(*) FROM platforms
UNION ALL
SELECT 'Banks', COUNT(*) FROM banks
UNION ALL
SELECT 'Transactions', COUNT(*) FROM transactions;
EOF

echo ""
echo "🎉 PSP System Ready!"
