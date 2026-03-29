#!/bin/bash

echo "🌴 Caribbean - Quick Start"
echo "=========================="

# Build everything (packages first, then apps)
echo "📦 Building all packages and apps..."
pnpm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi

echo ""
echo "✅ Build complete!"
echo ""

# Start server in background
echo "🚀 Starting Server..."
pnpm exec caribbean-server start

if [ $? -ne 0 ]; then
  echo "❌ Failed to start server"
  exit 1
fi

# Start agent in background
echo ""
echo "🚀 Starting Agent..."
pnpm exec caribbean-agent start

if [ $? -ne 0 ]; then
  echo "❌ Failed to start agent"
  exit 1
fi

echo ""
echo "✅ Server and Agent started in background"
echo ""
echo "Useful commands:"
echo "  pnpm server:status    - Check server status"
echo "  pnpm server:logs      - View server logs"
echo "  pnpm server:stop      - Stop server"
echo "  pnpm agent:status     - Check agent status"
echo "  pnpm agent:logs       - View agent logs"
echo "  pnpm agent:stop       - Stop agent"
