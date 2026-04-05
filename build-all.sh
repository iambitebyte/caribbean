#!/bin/bash

echo "Building Caribbean Server and Web Dashboard..."
echo "================================================"

# Build shared package
echo "Building Shared Package..."
cd packages/shared
pnpm run build

# Build protocol package
echo "Building Protocol Package..."
cd ../protocol
pnpm run build

# Build web app
echo "Building Web Dashboard..."
cd ../../apps/web
pnpm run build

# Create server web directory
echo "Copying Web Dashboard to Server..."
cd ../server
mkdir -p dist/web

# Copy web build to server
cp -r ../web/dist/* dist/web/

# Build server
echo "Building Server..."
pnpm run build

echo ""
echo "================================================"
echo "✅ Build complete!"
echo ""
echo "To start the server:"
echo "  cd apps/server"
echo "  npm start"
echo ""
echo "Then open: http://localhost:3000"
