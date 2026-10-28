#!/usr/bin/env bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}═$(printf '═%.0s' $(seq 1 58))═${NC}"
echo -e "${CYAN}  SECRETS: Hardcoded Secret Scanning (gitleaks)${NC}"
echo -e "${CYAN}═$(printf '═%.0s' $(seq 1 58))═${NC}"

report="gitleaks-report.json"
config=".gitleaks/gitleaks.toml"

run_gitleaks() {
  gitleaks detect \
    --source . \
    --config "$config" \
    --report-path "$report" \
    --redact \
    --verbose || true
}

run_gitleaks_docker() {
  docker run --rm \
    -v "$(pwd):/repo" \
    -w /repo \
    zricethezav/gitleaks:latest \
    detect \
    --source . \
    --config "$config" \
    --report-path /repo/"$report" \
    --redact \
    --verbose || true
}

echo -e "\n${CYAN}[1/1] Scanning git history and working tree for leaked secrets${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if command -v gitleaks &> /dev/null; then
  echo -e "\n${GREEN}  Using installed gitleaks binary${NC}"
  run_gitleaks
elif command -v docker &> /dev/null; then
  echo -e "\n${YELLOW}  gitleaks not installed, using Docker fallback${NC}"
  run_gitleaks_docker
else
  echo -e "\n${RED}  ❌ Neither gitleaks binary nor docker available${NC}"
  echo -e "     Install: brew install gitleaks"
  echo -e "     Or: https://github.com/gitleaks/gitleaks/releases"
  exit 1
fi

if [ -f "$report" ]; then
  findings=$(node -e "try{const r=require('./${report}');if(Array.isArray(r)){console.log(r.length)}else{console.log(r.length||0)}}catch(e){console.log('unknown')}" 2>/dev/null || echo "report exists")
  echo -e "\n${GREEN}  ✅ Gitleaks scan complete${NC}"
  echo -e "     Report: $report"
  echo -e "     Findings flagged for the secrets build gate: ${findings}"
  echo -e "\n${YELLOW}  Reminder: the seeded credentials in backend/seeded-secret.env are${NC}"
  echo -e "${YELLOW}  intentionally fake. Detection of them is the demo, not a real leak.${NC}"
else
  echo -e "\n${RED}  ❌ Scan ran but no report was produced${NC}"
  exit 1
fi

echo -e "\n${CYAN}═$(printf '═%.0s' $(seq 1 58))═${NC}"
echo -e "${GREEN}  Secrets scan complete!${NC}"
echo -e "${CYAN}═$(printf '═%.0s' $(seq 1 58))═${NC}"
