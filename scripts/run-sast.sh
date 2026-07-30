#!/usr/bin/env bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}═$(printf '═%.0s' $(seq 1 58))═${NC}"
echo -e "${CYAN}  SAST: Static Application Security Testing${NC}"
echo -e "${CYAN}═$(printf '═%.0s' $(seq 1 58))═${NC}"

# ============================================
# Semgrep Scan
# ============================================
echo -e "\n${CYAN}[1/2] Running Semgrep SAST Scan${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if command -v semgrep &> /dev/null; then
  # Run with default rules + custom notes-app rules
  semgrep \
    --config=auto \
    --config=.semgrep/ \
    --severity=ERROR \
    --severity=WARNING \
    --output=semgrep-report.sarif \
    --sarif \
    backend/ frontend/ || true

  echo -e "\n${GREEN}  ✅ Semgrep scan complete${NC}"
  echo -e "     Report: semgrep-report.sarif"
else
  echo -e "\n${RED}  ⚠️  Semgrep not installed. Install with:${NC}"
  echo -e "     pip install semgrep"
  echo -e "     or: brew install semgrep"
fi

# ============================================
# CodeQL Scan
# ============================================
echo -e "\n${CYAN}[2/2] Running CodeQL SAST Scan${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if command -v codeql &> /dev/null; then
  # Create CodeQL database
  echo -e "  Creating CodeQL database..."
  codeql database create codeql-db --language=javascript --source-root=. --overwrite

  # Run standard queries
  echo -e "  Running CodeQL analysis..."
  codeql database analyze codeql-db \
    --format=sarif-latest \
    --output=codeql-report.sarif \
    --download \
    codeql/javascript-queries:security-extended \
    codeql/javascript-queries:security-and-quality || true

  # Cleanup
  rm -rf codeql-db

  echo -e "\n${GREEN}  ✅ CodeQL scan complete${NC}"
  echo -e "     Report: codeql-report.sarif"
else
  echo -e "\n${RED}  ⚠️  CodeQL CLI not installed. Install from:${NC}"
  echo -e "     https://github.com/github/codeql-cli-binaries/releases"
fi

echo -e "\n${CYAN}═$(printf '═%.0s' $(seq 1 58))═${NC}"
echo -e "${GREEN}  SAST scan complete!${NC}"
echo -e "${CYAN}═$(printf '═%.0s' $(seq 1 58))═${NC}"
