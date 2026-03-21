#!/bin/bash

echo "🌴 Caribbean Server - Quick Start"
echo "=================================="

# Build everything
echo "📦 Building Web Dashboard and Server..."
cd apps/server
pnpm run build:all

if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi

echo ""
echo "✅ Build complete!"
echo ""
echo "Starting Server..."
echo ""

# Start server
npm start
