#!/bin/bash

echo "╔════════════════════════════════════════╗"
echo "║  🔨 Starting Build Process            ║"
echo "╚════════════════════════════════════════╝"

# Exit on error
set -e

# Show Node version
echo ""
echo "📋 Environment Info:"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Working directory: $(pwd)"

# Install backend dependencies
echo ""
echo "📦 Step 1: Installing backend dependencies..."
npm install --legacy-peer-deps

# Navigate to frontend
echo ""
echo "🎨 Step 2: Building frontend..."

# Check if frontend directory exists
if [ ! -d "../frontend" ]; then
  echo "❌ Error: frontend directory not found!"
  echo "Current location: $(pwd)"
  echo "Contents: $(ls -la ..)"
  exit 1
fi

cd ../frontend

# Clean install frontend dependencies
echo "📦 Installing frontend dependencies..."
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# Build frontend
echo "🏗️  Running frontend build..."
npm run build

# Verify build output
if [ ! -d "dist" ]; then
  echo "❌ Error: Frontend build failed - dist folder not created"
  exit 1
fi

echo "✅ Frontend build successful"
echo "📁 Build output:"
ls -la dist

# Copy frontend build to backend
echo ""
echo "📋 Step 3: Copying frontend build to backend..."
cd ..

# Remove old dist if exists
rm -rf backend/dist

# Copy new build
cp -r frontend/dist backend/dist

# Verify copy
if [ -d "backend/dist" ]; then
  echo "✅ Frontend build copied successfully"
  echo "📁 Files in backend/dist:"
  ls -la backend/dist | head -10
else
  echo "❌ Error: Failed to copy dist folder"
  exit 1
fi

# Go back to backend
cd backend

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  ✅ Build Complete!                   ║"
echo "╚════════════════════════════════════════╝"