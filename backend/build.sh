#!/bin/bash

echo "╔════════════════════════════════════════╗"
echo "║  🔨 Starting Build Process            ║"
echo "╚════════════════════════════════════════╝"

set -e

echo ""
echo "📋 Environment:"
echo "Node: $(node --version)"
echo "NPM: $(npm --version)"
echo "Current: $(pwd)"
echo ""

# Install backend dependencies
echo "📦 Step 1: Installing backend dependencies..."
npm install

# Navigate to frontend
echo ""
echo "🎨 Step 2: Building frontend..."

PROJECT_ROOT="$(cd .. && pwd)"
FRONTEND_PATH="$PROJECT_ROOT/frontend"
BACKEND_PATH="$PROJECT_ROOT/backend"

echo "Frontend: $FRONTEND_PATH"
echo "Backend: $BACKEND_PATH"

cd "$FRONTEND_PATH"
echo "✅ In: $(pwd)"

# Clean install with all dependencies (including dev)
echo ""
echo "📦 Step 3: Installing frontend dependencies..."
rm -rf node_modules package-lock.json .vite-temp

# Install ALL dependencies (not just production)
npm install --include=dev

# Verify critical packages
echo ""
echo "🔍 Verifying installations..."
if [ ! -d "node_modules/vite" ]; then
  echo "❌ Vite not found! Installing..."
  npm install vite@5.4.11 --save
fi

if [ ! -d "node_modules/@vitejs/plugin-react" ]; then
  echo "❌ @vitejs/plugin-react not found! Installing..."
  npm install @vitejs/plugin-react@4.3.3 --save
fi

echo "✅ Vite: $(ls -d node_modules/vite 2>/dev/null || echo 'NOT FOUND')"
echo "✅ Plugin: $(ls -d node_modules/@vitejs/plugin-react 2>/dev/null || echo 'NOT FOUND')"

# Build frontend
echo ""
echo "🏗️  Step 4: Building frontend..."
npm run build

# Verify build
if [ ! -d "dist" ]; then
  echo "❌ Build failed - no dist directory"
  exit 1
fi

echo "✅ Build successful!"
echo "📁 Dist contents:"
ls -la dist | head -10

# Copy to backend
echo ""
echo "📋 Step 5: Copying build to backend..."
cd "$PROJECT_ROOT"
rm -rf "$BACKEND_PATH/dist"
cp -r "$FRONTEND_PATH/dist" "$BACKEND_PATH/dist"

if [ -d "$BACKEND_PATH/dist" ]; then
  echo "✅ Build copied to backend"
  ls -la "$BACKEND_PATH/dist" | head -5
else
  echo "❌ Failed to copy build"
  exit 1
fi

cd "$BACKEND_PATH"

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  ✅ Build Complete!                   ║"
echo "╚════════════════════════════════════════╝"