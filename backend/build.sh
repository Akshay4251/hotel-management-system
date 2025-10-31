#!/bin/bash

echo "╔════════════════════════════════════════╗"
echo "║  🔨 Starting Build Process            ║"
echo "╚════════════════════════════════════════╝"

# Exit on any error
set -e

# Print commands as they execute (for debugging)
set -x

echo ""
echo "📋 Environment Info:"
echo "Node: $(node --version)"
echo "NPM: $(npm --version)"
echo "Current Dir: $(pwd)"
echo ""

# Step 1: Install backend dependencies
echo "📦 Step 1: Installing backend dependencies..."
npm install

# Step 2: Navigate to frontend
echo ""
echo "🎨 Step 2: Preparing frontend..."

# Get the absolute path of project root
PROJECT_ROOT="$(cd .. && pwd)"
FRONTEND_PATH="$PROJECT_ROOT/frontend"
BACKEND_PATH="$PROJECT_ROOT/backend"

echo "Project Root: $PROJECT_ROOT"
echo "Frontend Path: $FRONTEND_PATH"
echo "Backend Path: $BACKEND_PATH"

# Check if frontend exists
if [ ! -d "$FRONTEND_PATH" ]; then
  echo "❌ ERROR: Frontend directory not found at $FRONTEND_PATH"
  echo "Directory structure:"
  ls -la "$PROJECT_ROOT"
  exit 1
fi

# Go to frontend
cd "$FRONTEND_PATH"
echo "✅ Changed to: $(pwd)"

# Step 3: Install frontend dependencies
echo ""
echo "📦 Step 3: Installing frontend dependencies..."
echo "Contents of frontend directory:"
ls -la

# Remove node_modules and package-lock to ensure clean install
rm -rf node_modules package-lock.json

# Install with verbose output
npm install --verbose

# Verify vite is installed
echo ""
echo "🔍 Verifying Vite installation..."
if [ -f "node_modules/.bin/vite" ]; then
  echo "✅ Vite found at: node_modules/.bin/vite"
else
  echo "❌ Vite not found! Installing explicitly..."
  npm install vite --save-dev
fi

# Step 4: Build frontend
echo ""
echo "🏗️  Step 4: Building frontend..."
npx vite build

# Verify build output
if [ ! -d "dist" ]; then
  echo "❌ ERROR: Build failed - dist directory not created"
  exit 1
fi

echo "✅ Frontend build successful!"
echo "📁 Build output (first 10 files):"
ls -la dist | head -10

# Step 5: Copy to backend
echo ""
echo "📋 Step 5: Copying frontend build to backend..."
cd "$PROJECT_ROOT"

# Remove old dist
rm -rf "$BACKEND_PATH/dist"

# Copy new dist
cp -r "$FRONTEND_PATH/dist" "$BACKEND_PATH/dist"

# Verify
if [ -d "$BACKEND_PATH/dist" ]; then
  echo "✅ Build copied to backend successfully"
  echo "📁 Files in backend/dist:"
  ls -la "$BACKEND_PATH/dist" | head -10
else
  echo "❌ ERROR: Failed to copy dist to backend"
  exit 1
fi

# Return to backend
cd "$BACKEND_PATH"

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  ✅ Build Complete!                   ║"
echo "╚════════════════════════════════════════╝"