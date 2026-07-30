#!/usr/bin/env bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

TARGET_URL="${1:-http://localhost:5173}"
REPORT_NAME="${2:-zap-report.html}"

echo -e "${CYAN}═$(printf '═%.0s' $(seq 1 58))═${NC}"
echo -e "${CYAN}  DAST: Dynamic Application Security Testing${NC}"
echo -e "${CYAN}  Target: $TARGET_URL${NC}"
echo -e "${CYAN}═$(printf '═%.0s' $(seq 1 58))═${NC}"

# Check if Docker is available
if ! command -v docker &> /dev/null; then
  echo -e "\n${RED}  ❌ Docker is required for OWASP ZAP${NC}"
  echo -e "     Install Docker: https://docs.docker.com/get-docker/"
  exit 1
fi

# ============================================
# ZAP Baseline Scan (Passive)
# ============================================
echo -e "\n${CYAN}[1/1] Running OWASP ZAP Baseline Scan${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo -e "  Target:     $TARGET_URL"
echo -e "  Report:     $REPORT_NAME"
echo -e "  Rules:      .zap/rules.tsv"
echo -e "  Mode:       Baseline (passive checks)\n"

# Run ZAP in Docker
docker run --rm \
  -v "$(pwd):/zap/wrk:rw" \
  -w /zap/wrk \
  zaproxy/zap-stable \
  zap-baseline.py \
    -t "$TARGET_URL" \
    -r "$REPORT_NAME" \
    -c .zap/rules.tsv \
    -j \
    -a \
    -d || true

echo -e "\n${GREEN}  ✅ ZAP scan complete${NC}"
echo -e "     Report: $REPORT_NAME"

ZAP_EXIT=$?
echo -e "\n  ZAP exit code: $ZAP_EXIT"
if [ $ZAP_EXIT -eq 1 ]; then
  echo -e "  ${RED}⚠️  Warnings found (informational)${NC}"
elif [ $ZAP_EXIT -eq 2 ]; then
  echo -e "  ${RED}❌ Failures found (high-risk alerts)${NC}"
elif [ $ZAP_EXIT -eq 0 ]; then
  echo -e "  ${GREEN}✅ No issues found${NC}"
fi

echo -e "\n${CYAN}═$(printf '═%.0s' $(seq 1 58))═${NC}"
echo -e "${GREEN}  DAST scan complete!${NC}"
echo -e "${CYAN}═$(printf '═%.0s' $(seq 1 58))═${NC}"
exit $ZAP_EXIT
