#!/usr/bin/env bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}═$(printf '═%.0s' $(seq 1 58))═${NC}"
echo -e "${CYAN}  SCA: Software Composition Analysis${NC}"
echo -e "${CYAN}═$(printf '═%.0s' $(seq 1 58))═${NC}"

# ============================================
# npm audit
# ============================================
echo -e "\n${CYAN}[1/2] Running npm audit${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "\n${GREEN}  Backend npm audit:${NC}"
cd backend
npm audit --audit-level=high || true
cd ..

echo -e "\n${GREEN}  Frontend npm audit:${NC}"
cd frontend
npm audit --audit-level=high || true
cd ..

# ============================================
# OWASP Dependency-Check
# ============================================
echo -e "\n${CYAN}[2/2] Running OWASP Dependency-Check${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if command -v dependency-check.sh &> /dev/null; then
  dependency-check.sh \
    --project "notes-app" \
    --scan . \
    --format HTML \
    --format SARIF \
    --out depcheck-report \
    --failOnCVSS 7 \
    --suppression .dependency-check/suppressions.xml || true

  echo -e "\n${GREEN}  ✅ Dependency-Check complete${NC}"
  echo -e "     Report: depcheck-report/"
else
  echo -e "\n${RED}  ⚠️  OWASP Dependency-Check not installed.${NC}"
  echo -e "     Install: brew install dependency-check"
  echo -e "     Or download: https://owasp.org/www-project-dependency-check/"
  
  # Try Docker alternative
  echo -e "\n${YELLOW}  Trying Docker alternative...${NC}"
  if command -v docker &> /dev/null; then
    docker run --rm \
      -v "$(pwd):/src" \
      -v "$(pwd)/depcheck-report:/report" \
      owasp/dependency-check \
      --scan /src \
      --format HTML \
      --out /report \
      --failOnCVSS 7 \
      --suppression /src/.dependency-check/suppressions.xml || true
    echo -e "\n${GREEN}  ✅ Dependency-Check (Docker) complete${NC}"
  else
    echo -e "\n${RED}  ❌ Skipping OWASP Dependency-Check${NC}"
  fi
fi

# ============================================
# SCA Regression Tests
# ============================================
echo -e "\n${CYAN}Running SCA regression tests...${NC}"
node tests/vulnerability/regression-sca.js

echo -e "\n${CYAN}═$(printf '═%.0s' $(seq 1 58))═${NC}"
echo -e "${GREEN}  SCA scan complete!${NC}"
echo -e "${CYAN}═$(printf '═%.0s' $(seq 1 58))═${NC}"
