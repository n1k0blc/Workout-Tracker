#!/bin/bash
# Pre-Deployment Inspection Script for Raspberry Pi
# Run this FIRST before deploying anything!

echo "====================================="
echo "🔍 Raspberry Pi System Check"
echo "====================================="
echo ""

# System Info
echo "📊 SYSTEM INFORMATION"
echo "-------------------------------------"
echo "Hostname: $(hostname)"
echo "OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
echo "Kernel: $(uname -r)"
echo "Architecture: $(uname -m)"
echo ""

# CPU Info
echo "💻 CPU INFORMATION"
echo "-------------------------------------"
cat /proc/cpuinfo | grep "Model" | head -1
echo "CPU Cores: $(nproc)"
echo "CPU Temperature: $(vcgencmd measure_temp 2>/dev/null || echo 'N/A')"
echo ""

# Memory
echo "🧠 MEMORY USAGE"
echo "-------------------------------------"
free -h
echo ""
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
USED_RAM=$(free -m | awk '/^Mem:/{print $3}')
FREE_RAM=$(free -m | awk '/^Mem:/{print $4}')
PERCENT_USED=$((USED_RAM * 100 / TOTAL_RAM))
echo "Memory Usage: ${USED_RAM}MB / ${TOTAL_RAM}MB (${PERCENT_USED}%)"
echo "Available: ${FREE_RAM}MB"
echo ""

# Disk Space
echo "💾 DISK SPACE"
echo "-------------------------------------"
df -h | grep -E '^/dev/'
echo ""
ROOT_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
echo "Root partition usage: ${ROOT_USAGE}%"
echo ""

# Network
echo "🌐 NETWORK"
echo "-------------------------------------"
ip -4 addr show | grep inet | grep -v 127.0.0.1
echo ""

# Check for existing apps
echo "📦 EXISTING APPLICATIONS"
echo "-------------------------------------"
if [ -d ~/apps ]; then
    echo "Apps directory exists: ~/apps"
    ls -la ~/apps/
else
    echo "No ~/apps directory found"
fi
echo ""

# Docker
echo "🐳 DOCKER STATUS"
echo "-------------------------------------"
if command -v docker &> /dev/null; then
    echo "✅ Docker installed: $(docker --version)"
    echo ""
    echo "Running containers:"
    docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    echo "All containers (including stopped):"
    docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
    echo ""
    echo "Docker resource usage:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
else
    echo "❌ Docker not installed"
fi
echo ""

# Port Usage
echo "🔌 PORT USAGE (Common Web Ports)"
echo "-------------------------------------"
for port in 80 443 3000 3001 3002 3003 5432 5555 8080 8443 9000; do
    if lsof -i :$port 2>/dev/null | grep -q LISTEN; then
        echo "Port $port: ⚠️  IN USE"
        lsof -i :$port 2>/dev/null | grep LISTEN
    else
        echo "Port $port: ✅ Available"
    fi
done
echo ""

# Cloudflare Tunnel
echo "☁️  CLOUDFLARE TUNNEL"
echo "-------------------------------------"
if command -v cloudflared &> /dev/null; then
    echo "✅ Cloudflared installed: $(cloudflared --version)"
    echo ""
    if systemctl is-active --quiet cloudflared; then
        echo "Tunnel status: 🟢 RUNNING"
    else
        echo "Tunnel status: 🔴 NOT RUNNING"
    fi
    echo ""
    if [ -f ~/.cloudflared/config.yml ]; then
        echo "Existing tunnel config found:"
        cat ~/.cloudflared/config.yml
    else
        echo "No tunnel config found at ~/.cloudflared/config.yml"
    fi
    echo ""
    echo "Existing tunnels:"
    cloudflared tunnel list 2>/dev/null || echo "Unable to list tunnels (may need to login)"
else
    echo "❌ Cloudflared not installed"
fi
echo ""

# Web Servers
echo "🌍 WEB SERVERS"
echo "-------------------------------------"
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx is running"
    if [ -f /etc/nginx/sites-enabled/* ]; then
        echo "Nginx sites:"
        ls -la /etc/nginx/sites-enabled/
    fi
else
    echo "Nginx: not running or not installed"
fi

if systemctl is-active --quiet apache2; then
    echo "✅ Apache is running"
else
    echo "Apache: not running or not installed"
fi
echo ""

# Process Explorer
echo "🔍 TOP PROCESSES BY MEMORY"
echo "-------------------------------------"
ps aux --sort=-%mem | head -11
echo ""

echo "🔍 TOP PROCESSES BY CPU"
echo "-------------------------------------"
ps aux --sort=-%cpu | head -11
echo ""

# Summary & Recommendations
echo "====================================="
echo "📋 SUMMARY & RECOMMENDATIONS"
echo "====================================="
echo ""

if [ $TOTAL_RAM -lt 2048 ]; then
    echo "⚠️  WARNING: Less than 2GB RAM available"
    echo "   Your Pi has ${TOTAL_RAM}MB RAM. Consider:"
    echo "   - Using lightweight containers"
    echo "   - Setting memory limits in docker-compose"
    echo "   - Monitoring resource usage closely"
fi

if [ $PERCENT_USED -gt 80 ]; then
    echo "⚠️  WARNING: High memory usage (${PERCENT_USED}%)"
    echo "   Consider closing unused services before deployment"
fi

if [ $ROOT_USAGE -gt 80 ]; then
    echo "⚠️  WARNING: Disk space usage high (${ROOT_USAGE}%)"
    echo "   Consider cleaning up before deployment"
fi

echo ""
echo "✅ Inspection complete!"
echo ""
echo "Next steps:"
echo "1. Review the output above"
echo "2. Note which ports are in use"
echo "3. Check existing Cloudflare tunnel config"
echo "4. Decide on port assignments for workout-tracker"
echo "   Suggested: Backend=3001, Frontend=3000 (if available)"
echo "   Or use: Backend=3002, Frontend=3003 (as alternatives)"
echo ""
