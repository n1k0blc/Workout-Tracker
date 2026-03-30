#!/bin/bash
set -e

echo "🚀 Deploying Workout Tracker..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Pre-flight checks
echo -e "${YELLOW}🔍 Running pre-flight checks...${NC}"

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}❌ Error: .env.production file not found!${NC}"
    echo "Please create it from .env.production.example"
    exit 1
fi

# Check available memory
AVAILABLE_MEM=$(free -m | awk 'NR==2{print $7}')
if [ $AVAILABLE_MEM -lt 500 ]; then
    echo -e "${YELLOW}⚠️  WARNING: Low memory available (${AVAILABLE_MEM}MB)${NC}"
    echo "This deployment might be slow or fail."
    read -p "Continue anyway? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo "Deployment cancelled."
        exit 1
    fi
fi

# Check disk space
AVAILABLE_DISK=$(df -h . | awk 'NR==2{print $4}' | sed 's/G//')
if (( $(echo "$AVAILABLE_DISK < 5" | bc -l) )); then
    echo -e "${YELLOW}⚠️  WARNING: Low disk space (${AVAILABLE_DISK}GB)${NC}"
    read -p "Continue anyway? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo "Deployment cancelled."
        exit 1
    fi
fi

# Check if ports are in use (optional warning)
if lsof -i :3000 | grep -q LISTEN; then
    echo -e "${YELLOW}⚠️  Port 3000 is already in use!${NC}"
    echo "Make sure docker-compose.prod.yml uses alternative ports."
    echo "Or stop the conflicting service first."
    read -p "Continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}✅ Pre-flight checks passed${NC}"
echo ""

# Pull latest code
echo -e "${YELLOW}📥 Pulling latest code...${NC}"
git pull origin main

# Build and start containers
echo -e "${YELLOW}🐳 Building Docker images...${NC}"
docker compose -f docker-compose.prod.yml build --no-cache

echo -e "${YELLOW}🔄 Starting containers...${NC}"
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 10

# Check container status
echo -e "${YELLOW}📊 Container Status:${NC}"
docker compose -f docker-compose.prod.yml ps

# Health checks
echo -e "${YELLOW}🏥 Running health checks...${NC}"
sleep 5

# Check backend
if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo "⚠️  Backend health check failed"
fi

# Check frontend
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is healthy${NC}"
else
    echo "⚠️  Frontend health check failed"
fi

# Cleanup old images
echo -e "${YELLOW}🧹 Cleaning up old Docker images...${NC}"
docker image prune -f

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "📝 View logs with: docker compose -f docker-compose.prod.yml logs -f"
echo "🔍 Check status with: docker compose -f docker-compose.prod.yml ps"
