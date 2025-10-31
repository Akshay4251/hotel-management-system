#!/bin/bash

echo "╔════════════════════════════════════════╗"
echo "║  🔨 Starting Build Process            ║"
echo "╚════════════════════════════════════════╝"

# Exit on error
set -e

# Install backend dependencies
echo ""
echo "📦 Step 1: Installing backend dependencies..."
npm install

# Navigate to frontend
echo ""
echo "🎨 Step 2: Building frontend..."
cd ../frontend

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm install

# Build frontend
echo "🏗️  Running frontend build..."
npm run build

# Copy frontend build to backend
echo ""
echo "📋 Step 3: Copying frontend build to backend..."
cd ..
rm -rf backend/dist
cp -r frontend/dist backend/dist

# Verify build
if [ -d "backend/dist" ]; then
  echo "✅ Frontend build copied successfully"
  echo "📁 Files in dist:"
  ls -la backend/dist
else
  echo "❌ Error: dist folder not found"
  exit 1
fi

# Go back to backend
cd backend

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  ✅ Build Complete!                   ║"
echo "╚════════════════════════════════════════╝"