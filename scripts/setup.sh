#!/bin/bash

# Mettig Local Development Setup Script
# Initializes Docker environment, runs migrations, and seeds database

set -e

echo "🚀 Mettig Local Development Setup"
echo "=================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install docker-compose first."
    exit 1
fi

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "✅ .env created. Update it with your configuration if needed."
fi

# Create necessary directories
mkdir -p backend/src/db/migrations

# Stop any running containers
echo "⏹️  Stopping any existing containers..."
docker-compose down 2>/dev/null || true

# Build and start Docker services
echo "🐳 Starting Docker services..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker exec mettig-postgres pg_isready -U mettig > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ PostgreSQL failed to start"
        exit 1
    fi
    sleep 1
done

# Wait for MinIO to be ready
echo "⏳ Waiting for MinIO to be ready..."
for i in {1..30}; do
    if docker exec mettig-minio curl -s http://localhost:9000/minio/health/live > /dev/null 2>&1; then
        echo "✅ MinIO is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  MinIO health check failed, but continuing..."
        break
    fi
    sleep 1
done

# Wait a bit for backend to initialize
echo "⏳ Waiting for backend to initialize..."
sleep 5

# Run database migrations
echo "🔄 Running database migrations..."
docker-compose exec -T backend npm run db:migrate 2>/dev/null || {
    echo "⚠️  Database migration had issues, but setup continues..."
}

# Run database seed
echo "🌱 Seeding database..."
docker-compose exec -T backend npm run db:seed 2>/dev/null || {
    echo "⚠️  Database seeding had issues, but setup continues..."
}

echo ""
echo "✨ Setup complete!"
echo ""
echo "📝 Available services:"
echo "   - PostgreSQL:     postgres://mettig:mettig_dev_password@localhost:5432/mettig"
echo "   - MinIO Console:  http://localhost:9001 (minioadmin / minioadmin)"
echo "   - MinIO API:      http://localhost:9000"
echo "   - Backend API:    http://localhost:3000"
echo ""
echo "🚀 Next steps:"
echo "   - View logs:      docker-compose logs -f"
echo "   - Stop services:  docker-compose down"
echo "   - Reset database: docker-compose down -v && ./scripts/setup.sh"
echo ""
echo "📚 Backend is running in development mode with hot reload."
echo "   Changes to backend/src will automatically restart the server."
