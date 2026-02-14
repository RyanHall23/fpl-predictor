#!/bin/bash

echo "🧹 Starting clean process..."

# Stop any running Node processes on port 5000 (backend)
echo "Stopping backend server..."
lsof -ti:5000 | xargs kill -9 2>/dev/null || echo "No backend process running on port 5000"

# Stop any running frontend dev server on common ports
echo "Stopping frontend server..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "No frontend process running on port 3000"
lsof -ti:5173 | xargs kill -9 2>/dev/null || echo "No frontend process running on port 5173"

# Drop MongoDB database
echo "Dropping MongoDB database 'fplpredictor'..."
mongosh fplpredictor --eval "db.dropDatabase()" 2>/dev/null || \
mongo fplpredictor --eval "db.dropDatabase()" 2>/dev/null || \
echo "⚠️  Could not connect to MongoDB. Make sure MongoDB is running."

# Remove node_modules and package-lock files
echo "Removing node_modules directories..."
rm -rf node_modules
rm -rf backend/node_modules
rm -rf frontend/node_modules

echo "Removing package-lock files..."
rm -f package-lock.json
rm -f backend/package-lock.json
rm -f frontend/package-lock.json

# Clear npm cache
echo "Clearing npm cache..."
npm cache clean --force

# Reinstall dependencies
echo "Installing root dependencies..."
npm install

echo "Installing backend dependencies..."
cd backend && npm install && cd ..

echo "Installing frontend dependencies..."
cd frontend && npm install && cd ..

echo "✅ Clean process completed!"
echo ""
echo "To start the application, run: npm start"
