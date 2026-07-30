# devsecops pipeline for web application security

a complete devsecops pipeline demonstrating automated security testing for a web application. every commit is automatically checked for vulnerabilities before release. integrates sast, dast, and sca scanning into a github actions ci/cd pipeline with build gating and vulnerability regression tests.

---

## architecture

```mermaid
graph tb
    subgraph developer["developer workflow"]
        direction LR
        a1[code commit] --> a2[push to github]
        a2 --> a3[open pull request]
    end

    subgraph cicd["github actions ci/cd pipeline"]
        direction TB
        b1[trigger: push / pull request]
        b1 --> b2[install dependencies]
        b2 --> b3{sast}
        b2 --> b4{sca}
        b3 --> b7[parallel execution]
        b4 --> b7
        b7 --> b8[start services]
        b8 --> b9{dast}
        b9 --> b10[vulnerability regression tests]
        b10 --> b11[build gate: pass / fail]
    end

    subgraph target["target application"]
        c1[frontend: react + vite] -->|http proxy| c2[backend: express + sqlite]
        c2 --> c3[(sqlite database)]
    end

    developer --> cicd
    cicd --> target
```

---

## project structure

```
web-app-sec-project/
├── frontend/                   # react + vite notes app (with xss vuln)
├── backend/                    # express + better-sqlite3 api (with sqli + idor)
├── .github/workflows/          # ci-pipeline.yml + nightly-dast.yml
├── tests/vulnerability/        # 4 vulnerability regression test suites
├── scripts/                    # 5 ci/cd helper scripts
├── .semgrep/                   # custom sast rules for xss, sqli, idor, misconfig
├── .zap/                       # owasp zap false positive suppression
├── .dependency-check/          # dependency-check suppression rules
├── docs/                       # deepdive + sast vs dast comparison
└── README.md                   # this file
```

---

## what is demonstrated

this project contains a deliberately vulnerable notes application and a ci/cd pipeline that scans every commit for security issues.

### intentional vulnerabilities

| vulnerability | location | how it works |
|---|---|---|
| cross-site scripting (xss) | frontend notecard.jsx | note content rendered via dangerouslysetinnerhtml |
| sql injection (sqli) | backend routes/notes.js | user input concatenated into sql query |
| insecure direct object reference (idor) | backend routes/notes.js | no authentication on any endpoint |
| security misconfiguration | backend server.js | helmet csp and xss filter disabled |
| outdated dependencies | package.json files | express@4.17.1, lodash@4.17.20, axios@0.21.1 |

### security scanning tools

| tool | category | what it does | build gate |
|---|---|---|---|
| semgrep | sast | pattern-based static analysis | fails on critical/high |
| codeql | sast | semantic dataflow analysis | fails on critical/high |
| npm audit | sca | npm dependency audit | fails on critical/high |
| owasp dependency-check | sca | comprehensive dep scan | fails on cvss >= 7 |
| owasp zap baseline | dast | passive runtime scanning | fails on high-risk alerts |

### build gates

every check must pass before a pull request can be merged. the pipeline runs in stages:

1. **sast stage** (parallel): semgrep + codeql scan source code
2. **sca stage** (parallel): npm audit + dependency-check scan dependencies
3. **dast stage**: owasp zap baseline scan against running application
4. **regression stage**: 4 vulnerability regression test suites run sequentially

---

## quick start

### prerequisites

- node.js 18+
- npm

### run locally

```bash
# terminal 1 - backend
cd backend
npm install
node server.js

# terminal 2 - frontend
cd frontend
npm install
npm run dev
```

open http://localhost:5173 in your browser.

### run security scans locally

```bash
# sast with semgrep
semgrep --config=.semgrep/ frontend/ backend/

# sast with codeql (requires codeql cli)
codeql database create codeql-db --language=javascript
codeql database analyze codeql-db --format=sarif-latest --output=results.sarif

# sca with npm audit
cd backend && npm audit
cd frontend && npm audit

# sca with dependency-check (requires java)
dependency-check --scan . --format HTML --out dep-report.html

# dast with zap (requires docker)
bash scripts/run-dast.sh

# vulnerability regression tests
bash scripts/run-vulnerability-regression.sh
```

### run the full pipeline locally

```bash
bash scripts/start-services.sh
bash scripts/run-sast.sh
bash scripts/run-sca.sh
bash scripts/run-dast.sh
bash scripts/run-vulnerability-regression.sh
```

---

## ci/cd pipelines

### pr/push pipeline (`.github/workflows/ci-pipeline.yml`)

runs on every push and pull request:
1. install dependencies
2. sast: semgrep scan
3. sast: codeql analysis
4. sca: npm audit
5. sca: owasp dependency-check
6. start services
7. dast: zap baseline scan
8. vulnerability regression tests
9. final build gate

### nightly pipeline (`.github/workflows/nightly-dast.yml`)

runs daily at 2:00 am utc:
1. full zap active scan (deep, aggressive)
2. sarif report generation
3. no build gating (informational)

---

## docs

| file | description |
|---|---|
| docs/deepdive.md | full project deepdive covering all 25 files |
| docs/security-comparison.md | sast vs dast coverage and false positive analysis |

---

## key design decisions

- **sqlite instead of postgres** for zero-config setup
- **better-sqlite3 instead of an orm** to expose clear sqli patterns for sast detection
- **react 17** because it has known cves for sca demonstration
- **zap baseline on pr, full scan nightly** as standard ci/cd practice
- **semgrep + codeql together** for both fast feedback and deep analysis
- **vulnerability regression tests** as a second defense layer after sast/dast/sca
- **express@4.17.1 and lodash@4.17.20 intentionally kept old** for sca tool detection

---

## license

mit
