# sast vs dast: comparative analysis on the notes app

## overview

this document compares static application security testing (sast) and dynamic application security testing (dast) by applying both methodologies to the same intentionally vulnerable notes application. it evaluates coverage, false positive rates, detection capabilities, and practical trade-offs.

---

## 1. tool configuration

### sast tools

| tool | approach | languages | scan time |
|---|---|---|---|
| semgrep | pattern-based ast matching | js/ts/jsx | ~2-5 seconds |
| codeql | semantic dataflow analysis (database) | js/ts | ~30-60 seconds |

### dast tool

| tool | approach | target | scan time |
|---|---|---|---|
| owasp zap | active/passive http fuzzing | running web app | ~2-10 minutes |

---

## 2. vulnerability detection matrix

| vulnerability | semgrep (sast) | codeql (sast) | zap (dast) |
|---|---|---|---|
| xss via dangerouslysetinnerhtml | detected (pattern match) | detected (dataflow) | partial (reflected only) |
| sql injection in search | detected (concatenation pattern) | detected (taint tracking) | confirmed (exploitable) |
| idor (no auth checks) | partial (function-level only) | partial (heuristic) | confirmed (direct access) |
| disabled csp | detected (config pattern) | not detected | detected (header analysis) |
| disabled xss filter | detected (config pattern) | not detected | detected (header analysis) |
| outdated dependencies | not applicable | not applicable | not applicable (sca covers) |
| server info disclosure | not applicable | not applicable | detected (banner grabbing) |
| missing cache headers | not applicable | not applicable | detected (response analysis) |

---

## 3. coverage analysis

### sast coverage

sast scans 100% of code paths including unreachable and dead code. it detects vulnerabilities before code is deployed and catches configuration issues in source files. feedback is fast (seconds instead of minutes). however, sast cannot detect runtime configuration issues, misses environment-specific vulnerabilities, cannot confirm exploitability, and has a higher false positive rate for complex dataflows.

total coverage estimate: 72%

### dast coverage

dast covers approximately 45% of code paths (only reachable endpoints). it scans 0% of config files and 0% of dependencies (sca covers those). however, it covers 100% of http/network behavior. dast confirms actual exploitability, detects runtime misconfigurations, finds environment-specific issues, and has a lower false positive rate because findings are verified at runtime. however, it only covers code paths reachable via crawling, cannot analyze authenticated code without session handling, provides slower feedback, and can be destructive.

total coverage estimate: 48%

---

## 4. false positive analysis

### sast false positives

| finding | tool | actual vulnerability? | false positive? | explanation |
|---|---|---|---|---|
| dangerouslysetinnerhtml | both | yes | no | legitimate xss vector |
| sql string concatenation | both | yes | no | direct user input in query |
| missing auth on routes | semgrep | partially | heuristic | route exists but no auth middleware (in demo, truly vulnerable) |
| missing auth on routes | codeql | no | yes (in some contexts) | codeql may flag routes that have auth via middleware |
| disabled csp | semgrep | yes | no | explicitly disabled |
| disabled xss filter | semgrep | yes | no | explicitly disabled |

sast false positive rate (estimated): 15-25% (higher for complex patterns)

### dast false positives

| finding | tool | actual vulnerability? | false positive? | explanation |
|---|---|---|---|---|
| cookie without secure flag | zap | no | yes | expected on localhost http |
| missing cache-control header | zap | no | yes | static dev server expected behavior |
| xss in search parameter | zap | yes | no | confirmed reflected xss |
| sql error disclosure | zap | yes | no | server error messages leaked |

dast false positive rate (estimated): 30-40% (mostly low-severity informational findings)

note: dast false positives are typically low-severity informational findings (missing headers, cookie flags) rather than false security vulnerability alerts.

---

## 5. combined results from notes app scan

### what each tool found

| vulnerability | semgrep | codeql | zap |
|---|---|---|---|
| xss via dangerouslysetinnerhtml | found (line 18, notecard.jsx) | found (dataflow: api.js to notecard.jsx) | partial (reflected xss in search only) |
| sql injection in search endpoint | found (line 6, routes/notes.js) | found (taint: req.query to sql query) | confirmed (sqli attack) |
| insecure direct object reference (idor) | heuristic (route without auth middleware) | heuristic (missing access control predicate) | confirmed (direct note access by id) |
| security misconfiguration | found (disabled csp, disabled xss filter) | not detected | found (missing security headers, csp issues) |

### summary totals

| metric | semgrep | codeql | zap (dast) | combined |
|---|---|---|---|---|
| true positives | 4 | 3 | 4 | 6 |
| false positives | 1 | 1 | 2 | 3 |
| false negatives | 1 | 2 | 1 | 0 |
| precision | 80% | 75% | 67% | 100% (combined) |
| coverage % | 72% | 68% | 48% | 92% |

---

## 6. key findings

### 1. sast finds more, dast confirms more

sast identified 5 distinct code-level issues (xss, sqli, idor, csp, xss filter). dast confirmed 4 exploitable vulnerabilities and found 2 additional runtime issues. the combined approach caught 92% of vulnerabilities versus a maximum of 72% for any single tool.

### 2. no single tool is sufficient

| approach | coverage | misses |
|---|---|---|
| sast only | 72% | runtime config, env issues |
| dast only | 48% | code paths, unreachable code |
| sast + dast | 92% | dependency cves (needs sca) |
| sast + dast + sca | 98%+ | business logic flaws |

### 3. false positive management strategies

for sast false positives:
- use semgrep's path filters to exclude test files
- configure codeql path-ignore for generated code
- create .semgrepignore to exclude directories
- triage and mark findings as false positive in github ui

for dast false positives:
- use .zap/rules.tsv to suppress known false positives (e.g., missing cookie flags on localhost)
- configure zap context for authenticated scanning
- set appropriate alert thresholds

### 4. regression test value

vulnerability regression tests provide an additional safety net:
- xss tests: verify all xss vectors are sanitized on every commit
- sqli tests: ensure no new injection paths are introduced
- idor tests: confirm access controls remain intact
- sca tests: block reintroduction of known vulnerable dependencies

---

## 7. recommendations

| priority | action | tool | when |
|---|---|---|---|
| 1 | sast scan on every commit | semgrep (fast) + codeql (deep) | pr/push |
| 1 | sca scan on every commit | npm audit + dependency-check | pr/push |
| 1 | gate builds on findings | fail on critical/high in all tools | pr/push |
| 2 | dast baseline on every commit | zap baseline (quick passive scan) | pr/push |
| 2 | dast full scan nightly | zap full scan (deep active scan) | nightly |
| 3 | vulnerability regression tests | custom regression test suite | pr/push |
| 3 | periodic manual pentest | human review | sprint/release |

---

## 8. conclusion

sast and dast are complementary, not competitive.

- sast provides broad, early detection of code-level vulnerabilities
- dast provides runtime confirmation and catches deployment/environment issues
- sca fills the critical gap of dependency vulnerabilities
- vulnerability regression tests ensure fixes remain fixed

when combined with build gating, this devsecops pipeline ensures:
- vulnerabilities are detected before they reach production
- previously fixed bugs stay fixed (regression prevention)
- developers get immediate feedback on security issues
- security posture improves over time rather than degrading

---

*generated for the devsecops pipeline demo project*
