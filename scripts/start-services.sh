#!/usr/bin/env bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Resolve repo root so script works from any working directory
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo -e "${CYAN}═$(printf '═%.0s' $(seq 1 58))═${NC}"
echo -e "${CYAN}  Starting DevSecOps Demo Services${NC}"
echo -e "${CYAN}═$(printf '═%.0s' $(seq 1 58))═${NC}"

# Kill any existing processes
echo -e "\n${YELLOW}  Cleaning up existing processes...${NC}"
if command -v lsof &> /dev/null; then
  kill $(lsof -t -i:3001 2>/dev/null) 2>/dev/null || true
  kill $(lsof -t -i:5173 2>/dev/null) 2>/dev/null || true
else
  pkill -f "node server.js" 2>/dev/null || true
  pkill -f "vite --port 5173" 2>/dev/null || true
fi
sleep 1

# Install dependencies if needed
if [ ! -d "backend/node_modules" ]; then
  echo -e "\n${YELLOW}  Installing backend dependencies...${NC}"
  (cd backend && npm install)
fi

if [ ! -d "frontend/node_modules" ]; then
  echo -e "\n${YELLOW}  Installing frontend dependencies...${NC}"
  (cd frontend && npm install)
fi

# Start backend
echo -e "\n${GREEN}  Starting backend on port 3001...${NC}"
(cd backend && node server.js) &
BACKEND_PID=$!

# Start frontend
echo -e "\n${GREEN}  Starting frontend on port 5173...${NC}"
(cd frontend && npx vite --port 5173) &
FRONTEND_PID=$!

cleanup() {
  echo -e "\n${YELLOW}  Stopping services...${NC}"
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  wait $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

# Wait for backend to be ready
echo -e "\n${YELLOW}  Waiting for services to be ready...${NC}"
backend_ready=0
for i in {1..15}; do
  if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    backend_ready=1
    break
  fi
  sleep 1
done

# Wait for frontend to be ready
frontend_ready=0
for i in {1..15}; do
  if curl -s -o /dev/null http://localhost:5173 > /dev/null 2>&1; then
    frontend_ready=1
    break
  fi
  sleep 1
done

if [ "$backend_ready" = "1" ] && [ "$frontend_ready" = "1" ]; then
  echo -e "${GREEN}  ✅ Backend ready on http://localhost:3001${NC}"
  echo -e "${GREEN}  ✅ Frontend ready on http://localhost:5173${NC}"
  echo -e "\n${CYAN}  Services running:${NC}"
  echo -e "      Backend PID:  $BACKEND_PID"
  echo -e "      Frontend PID: $FRONTEND_PID"
  echo -e "\n  Press Ctrl+C to stop all services"
  echo -e "${CYAN}═$(printf '═%.0s' $(seq 1 58))═${NC}"
  wait
else
  echo -e "${RED}  ❌ Services failed to start${NC}"
  [ "$backend_ready" != "1" ] && echo -e "${RED}     Backend health check failed${NC}"
  [ "$frontend_ready" != "1" ] && echo -e "${RED}     Frontend health check failed${NC}"
  cleanup
fi
