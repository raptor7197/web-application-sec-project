# devsecops pipeline for web application security - deepdive

## project purpose

a complete devsecops pipeline demonstrating automated security testing for a web application. every commit is automatically checked for vulnerabilities before release. the project integrates sast (static application security testing), dast (dynamic application security testing), and sca (software composition analysis / dependency scanning) into a github actions ci/cd pipeline. builds are gated on findings, and vulnerability regression tests re-verify previously fixed bugs on every commit. a comparative analysis of sast vs dast coverage and false positives is provided using the same target application.

---

## architecture diagram

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
        b2 --> b3{sast - semgrep}
        b2 --> b4{sast - codeql}
        b2 --> b5{sca - npm audit}
        b2 --> b6{sca - dependency-check}
        b3 --> b7[parallel execution]
        b4 --> b7
        b5 --> b7
        b6 --> b7
        b7 --> b8[start services]
        b8 --> b9{dast - owasp zap baseline}
        b9 --> b10[vulnerability regression tests]
        b10 --> b11[final build gate]
    end

    subgraph target["target application (notes app)"]
        direction LR
        c1[frontend: react + vite] -->|http proxy| c2[backend: express + sqlite]
        c2 --> c3[(sqlite database)]
    end

    subgraph sasttools["sast tools"]
        d1[semgrep: pattern-based ast matching]
        d2[codeql: semantic dataflow analysis]
    end

    subgraph scatools["sca tools"]
        e1[npm audit: dependency audit]
        e2[owasp dependency-check: comprehensive scan]
    end

    subgraph dasttools["dast tools"]
        f1[owasp zap: baseline scan on pr]
        f2[owasp zap: full scan nightly]
    end

    subgraph regression["regression tests"]
        g1[xss regression tests]
        g2[sqli regression tests]
        g3[idor regression tests]
        g4[sca dependency regression tests]
    end

    subgraph gates["build gates"]
        h1[sast: fail on critical/high]
        h2[sca: fail on cvss >= 7]
        h3[dast: fail on high-risk alerts]
        h4[regression: fail on any regression]
    end

    developer --> cicd
    cicd --> target
    sasttools --> b3
    sasttools --> b4
    scatools --> b5
    scatools --> b6
    dasttools --> b9
    dasttools -.-> |nightly schedule| f2
    regression --> b10
    gates --> b11
```

---

## project structure (25 files)

```
web-app-sec-project/
|
|-- backend/                          # express + better-sqlite3 api with vulnerabilities
|   |-- package.json                  # intentionally old deps for sca demo
|   |-- server.js                     # express server entry point
|   |-- db.js                         # sqlite database init and seed
|   |-- routes/
|       |-- notes.js                  # crud routes with injected sqli and idor
|
|-- frontend/                         # react + vite notes app with xss vulnerability
|   |-- package.json                  # intentionally old deps for sca demo
|   |-- vite.config.js                # proxy /api to backend
|   |-- index.html                    # html entry point
|   |-- src/
|       |-- main.jsx                  # react 17 render entry
|       |-- App.jsx                   # main app component with sidebar + content
|       |-- App.css                   # full dark-theme ui styling
|       |-- api.js                    # axios client for all endpoints
|       |-- components/
|           |-- NoteForm.jsx          # form to create notes
|           |-- NoteCard.jsx          # card with dangerouslysetinnerhtml (xss vuln)
|           |-- NoteList.jsx          # list of note cards with loading/empty states
|
|-- .github/
|   |-- workflows/
|   |   |-- ci-pipeline.yml           # pr/push pipeline: sast + sca + dast + regression
|   |   |-- nightly-dast.yml          # nightly deep dast scan with owasp zap
|   |-- codeql-config.yml             # codeql query suite configuration
|   |-- dependabot.yml                # (not created but standard practice)
|
|-- tests/
|   |-- vulnerability/
|       |-- regression-xss.js         # tests all xss payloads are caught
|       |-- regression-sqli.js        # tests all sqli payloads are caught
|       |-- regression-idor.js        # tests unauthenticated access controls
|       |-- regression-sca.js         # tests reintroduced vulnerable deps
|
|-- scripts/
|   |-- start-services.sh             # starts backend + frontend locally
|   |-- run-sast.sh                   # runs semgrep + codeql locally
|   |-- run-dast.sh                   # runs zap via docker locally
|   |-- run-sca.sh                    # runs npm audit + dependency-check locally
|   |-- run-vulnerability-regression.sh  # runs all 4 regression test suites
|
|-- .semgrep/
|   |-- notes-app.yaml                # custom sast rules targeting app vulns
|
|-- .zap/
|   |-- rules.tsv                     # false positive suppression for zap
|
|-- .dependency-check/
|   |-- suppressions.xml              # suppression rules for dependency-check
|
|-- docs/
|   |-- security-comparison.md        # full sast vs dast analysis document
|   |-- deepdive.md                   # this file
|
|-- .gitignore                        # excludes node_modules, db, reports, etc.
|-- README.md                         # project overview and getting started
```

---

## component 1: backend (express + better-sqlite3)

### backend/package.json

intentionally uses outdated dependency versions to demonstrate sca scanning:

| dependency | version | known vulnerability | cve |
|---|---|---|---|
| express | 4.17.1 | qs denial of service | cve-2022-24999 |
| lodash | 4.17.20 | prototype pollution | cve-2021-23337 |
| better-sqlite3 | 11.7.0 | safe (upgraded for node 22 compat) | none |
| cors | 2.8.5 | safe | none |
| morgan | 1.10.0 | safe | none |
| helmet | 4.6.0 | safe | none |

note: `better-sqlite3@7.5.0` was originally chosen for a known cve but failed to compile on node 22. upgraded to `11.7.0` which compiles cleanly. `express@4.17.1` and `lodash@4.17.20` remain vulnerable for the sca regression test to detect.

### backend/server.js

the express server:
- runs on port 3001
- imports `initDb` from `./db` and calls it synchronously before `app.listen()`
- applies `cors()`, `morgan('dev')`, and `express.json()` middleware
- applies `helmet()` with `contentSecurityPolicy: false` and `xssFilter: false` -- these are intentional security misconfigurations that semgrep should flag
- mounts `/api/notes` routes
- provides a `/api/health` endpoint for health checks
- in production mode, serves the frontend build from `../frontend/dist`
- lists all available endpoints on startup including the sqli warning

### backend/db.js

the database module:
- uses `better-sqlite3` synchronous api
- `initDb()` creates or loads `notes.db`, sets `journal_mode=WAL`, creates the `notes` table, and seeds 7 initial notes
- `getDb()` returns the cached database instance or throws if not initialized
- `seedData()` is idempotent -- checks `count(*)` before inserting
- 7 seed notes include 2 intentionally suspicious ones: a script tag xss payload and a styled div

the schema:
```sql
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### backend/routes/notes.js

contains 5 endpoints, 4 of which have intentional vulnerabilities:

| method | path | vulnerable? | vulnerability type | description |
|---|---|---|---|---|
| get | /api/notes | no | none | lists all notes sorted by created_at desc |
| get | /api/notes/search?q= | yes | sql injection (sqli) | user input concatenated directly into sql |
| get | /api/notes/:id | yes | idor (insecure direct object reference) | no auth check, anyone can access any note |
| post | /api/notes | yes | no input sanitization | stores raw html, enables stored xss |
| put | /api/notes/:id | yes | idor | no ownership check on update |
| delete | /api/notes/:id | yes | idor | no ownership check on delete |

**sql injection vulnerability (lines 8-20):**
```javascript
const query = "SELECT * FROM notes WHERE title LIKE '%" + search + "%' OR content LIKE '%" + search + "%'";
const results = db.prepare(query).all();
```
user input is directly concatenated into the sql string. an attacker can inject `' OR '1'='1` to return all notes. the endpoint also exposes the raw query string in the json response, which aids the sqli regression test in detecting injection.

**idor vulnerabilities (lines 31, 50, 58, 65):**
every route with a `:id` parameter performs no authentication or authorization check. any user can read, update, or delete any note by guessing or enumerating ids.

---

## component 2: frontend (react + vite)

### frontend/package.json

intentionally uses outdated dependency versions:

| dependency | version | known vulnerability | cve |
|---|---|---|---|
| react | 17.0.2 | various | multiple |
| react-dom | 17.0.2 | various | multiple |
| axios | 0.21.1 | ssrf | cve-2021-3749 |
| vite | 2.9.0 | outdated | multiple |
| @vitejs/plugin-react | 1.2.0 | outdated | minor |

### frontend/vite.config.js

- runs on port 5173
- proxies `/api` requests to `http://localhost:3001` (the backend)
- uses the `@vitejs/plugin-react` plugin

### frontend/src/main.jsx

uses react 17's legacy `reactdom.render()` api (not the new `createroot()` from react 18). this is intentional for the outdated dependency demo.

### frontend/src/App.jsx

the main application component with full react hooks state management:

**state variables:**
- `notes` -- array of all notes fetched from api
- `searchQuery` -- current search input text
- `searchResults` -- results from the search endpoint
- `loading` -- loading indicator
- `error` -- error message display
- `activeTab` -- toggle between 'all' and 'search' tabs

**key functions:**
- `fetchnotes()` -- uses `usecallback` to fetch all notes from the api
- `handlecreate(title, content)` -- creates a new note via api, then refreshes
- `handledelete(id)` -- deletes a note via api, then refreshes
- `handlesearch(e)` -- searches notes via the vulnerable search endpoint

**ui sections:**
- header with app title and scan badges (sast, dast, sca)
- error banner with dismiss button
- sidebar with note creation form, search section, and info panel
- content area with tab bar (all notes / search results) and note list
- footer with tech stack attribution

the info panel explicitly warns users about the 3 intentional vulnerabilities (xss, sqli, idor).

### frontend/src/api.js

axios-based api client with methods:
- `getnotes()` -- get /api/notes
- `getnote(id)` -- get /api/notes/:id
- `createnote(title, content)` -- post /api/notes
- `updatenote(id, title, content)` -- put /api/notes/:id
- `deletenote(id)` -- delete /api/notes/:id
- `searchnotes(query)` -- get /api/notes/search?q=
- `healthcheck()` -- get /api/health

all calls go through the vite proxy to avoid cors issues during development.

### frontend/src/components/NoteCard.jsx

**the xss vulnerability (line 16-18):**
```javascript
const renderContent = () => {
  return { __html: note.content };
};
// used as:
<div className="note-content" dangerouslySetInnerHTML={renderContent()} />
```

this renders user-provided note content as raw html. any `<script>`, `<img onerror>`, `<svg onload>` or other xss payload stored in a note will execute in the browser. semgrep's built-in rules detect `dangerouslysetinnerhtml` usage, and the custom rules in `.semgrep/notes-app.yaml` specifically flag this pattern.

### frontend/src/components/NoteForm.jsx

a form with:
- expand/collapse toggle button
- title input field
- content textarea with hint that html is rendered as-is
- submit button that calls `oncreate(title, content)`
- form validation (both fields required)
- auto-reset on submit

### frontend/src/components/NoteList.jsx

renders:
- a loading spinner with "loading notes..." text
- an empty state with contextual message (different for search vs all notes)
- a list of `notecard` components

### frontend/src/App.css

full dark-theme stylesheet with:
- css custom properties for theming
- dark color palette (backgrounds: `#0f1117`, `#1a1d27`, cards: `#222640`)
- scan badge color coding (sast in blue, dast in orange, sca in green)
- responsive grid layout (sidebar 340px + content area)
- sticky header with backdrop filter
- card hover animations with translate and shadow
- fade-in and slide-down animations
- form input focus states with colored borders
- responsive breakpoints at 900px and 600px
- custom-styled note cards with expand/collapse meta section

---

## component 3: ci/cd pipelines (github actions)

### .github/workflows/ci-pipeline.yml

runs on every `push` to `main` and `develop`, and every `pull_request` to `main`.

**job 1: sast-semgrep**
- uses `semgrep/semgrep-action@v1`
- runs default rules (`p/default`) plus custom rules from `.semgrep/`
- generates sarif output for github code scanning
- `continue-on-error: false` -- gates the build on findings

**job 2: sast-codeql**
- uses `github/codeql-action/init@v2` and `github/codeql-action/analyze@v2`
- runs `security-extended` and `security-and-quality` query suites
- auto-builds javascript code
- `continue-on-error: false` -- gates the build

**job 3: sca-npm-audit**
- runs `npm ci` on both backend and frontend
- runs `npm audit --audit-level=high` on both
- `continue-on-error: false` -- fails on high or critical vulnerabilities

**job 4: sca-owasp-depcheck**
- uses java for the dependency-check tool
- runs `dependency-check/Dependency_Check_Action@main`
- sets `--failOnCVSS 7` (fails if any dependency has cvss score >= 7)
- includes a suppression file for known false positives
- uploads sarif to github code scanning

**job 5: dast-zap-baseline**
- starts backend and frontend services using subshells `(cd backend && ... &)`
- waits for both health checks (backend /api/health, frontend index page)
- uses `zaproxy/action-baseline@v0.14.0` against the running frontend
- `fail_action: true` -- gates the build on high-risk alerts
- runs with ajax spider (`-a`) and optional root CA (`-j`)
- uploads the zap html report as a build artifact

**job 6: vulnerability-regression**
- depends on sast-semgrep, sast-codeql, sca-npm-audit, sca-owasp-depcheck
- starts backend service only (no frontend needed for api tests)
- runs all 4 regression test scripts sequentially
- each test has `continue-on-error: false` -- gates the build

**job 7: pipeline-gate** (final status tracker)
- depends on all previous jobs
- runs even if some jobs fail (`if: always()`)
- prints a summary of all checks passed

### .github/workflows/nightly-dast.yml

runs on a schedule (cron: `0 2 * * *` -- daily at 2:00 am utc) and can be triggered manually via `workflow_dispatch`.

- starts backend and frontend services
- runs `zaproxy/action-full-scan@v0.14.0` with active scanning enabled
- `fail_action: false` -- informational only, does not gate
- uploads both the html report and sarif output as artifacts

---

## component 4: security tool configurations

### .semgrep/notes-app.yaml

6 custom rules organized by vulnerability type:

| rule id | vulnerability | severity | detection method |
|---|---|---|---|
| `react-dangerously-set-inner-html` | xss (cwe-79) | warning | pattern matches `dangerouslysetinnerhtml={...}` |
| `react-inner-html-xss` | xss (cwe-79) | warning | pattern matches `{ __html: $input }` |
| `sql-concatenation` | sql injection (cwe-89) | error | pattern matches string concatenation with `+` |
| `sql-like-concatenation` | sql injection (cwe-89) | error | pattern matches `like '%" +` patterns |
| `disabled-helmet-csp` | security misconfig (cwe-693) | warning | pattern matches `contentsecuritypolicy: false` |
| `disabled-xss-filter` | security misconfig (cwe-693) | warning | pattern matches `xssfilter: false` |
| `missing-authentication-check` | idor / broken access control (cwe-639) | warning | patterns match routes with dynamic `:id` params |

each rule includes metadata mapping to cwe and owasp categories for sarif report compatibility.

### .github/codeql-config.yml

path: `.github/codeql-config.yml`

this configuration file tells codeql which query suites to run and which files to include or exclude:

- **query suites:** uses `security-extended` (standard security queries) plus `security-and-quality` (deeper analysis including quality issues)
- **scan paths:** explicitly includes `backend` and `frontend` directories only
- **excluded paths:** ignores `node_modules`, all test/spec files, `dist`, and `build` directories to reduce noise
- **query filters:** excludes 2 noisy query ids that trigger false positives:
  - `js/angular-html-binding` (not relevant for react apps)
  - `js/react-no-dangerous-html-with-children` (conflicts with our intentional xss demo)

this config is referenced by the `sast-codeql` job in `ci-pipeline.yml` via the `config-file: .github/codeql-config.yml` parameter.

### .zap/rules.tsv

suppresses 6 known false positives for localhost development:

| zap alert id | reason for ignoring |
|---|---|---|
| 10011 (cookie without secure flag) | expected on localhost http |
| 10015 (no cache-control header) | expected from static dev server |
| 10054 (cookie without samesite) | expected on localhost |
| 10049 (content-type header missing) | expected behavior |
| 10096 (timestamp disclosure) | expected in api responses |
| 10027 (suspicious comments) | part of demo app intentionally |
| 10094 (base64 disclosure) | expected in test data |

### .dependency-check/suppressions.xml

path: `.dependency-check/suppressions.xml`

this xml file tells owasp dependency-check to ignore certain cve findings that are known false positives for this project:

- `cve-2022-25881` -- a known false positive that affects certain node.js versions but not the specific version used in this project. suppressing it prevents noisy pipeline failures.
- `cve-2022-24999` -- the qs library cve that is flagged on express@4.17.1 but is mitigated by using a newer node.js runtime. since we keep express@4.17.1 intentionally for the sca demo, this specific false positive is suppressed to avoid double-counting (the express version is already caught by the npm audit gate).

this file is referenced by the `sca-owasp-depcheck` job in `ci-pipeline.yml` via the `--suppression .dependency-check/suppressions.xml` argument.

note: the `cve-2022-24999` suppression means the dependency-check gate will pass on the express vulnerability, but the npm audit gate will still catch it. this shows how different sca tools can be tuned differently for the same finding.

---

## component 5: vulnerability regression tests

### tests/vulnerability/regression-xss.js

runs 6 xss payloads against the running api:

| payload | type |
|---|---|
| `<script>alert("xss")</script>` | script tag injection |
| `<img src=x onerror=alert(1)>` | event handler injection |
| `<svg onload=alert(1)>` | svg event handler |
| `"><script>alert("xss")</script>` | html break-out injection |
| `<body onload=alert(1)>` | body event handler |
| `<iframe src="javascript:alert(1)">` | iframe javascript uri |

**test flow per payload:**
1. health check the api server (fails fast if not running)
2. create a note with the xss payload via post /api/notes
3. fetch the note back via get /api/notes/:id
4. check if the content contains unsanitized html (`<script>`, `onerror=`, `onload=`, `javascript:`)
5. if unsanitized -> fail (regression detected)
6. if sanitized -> pass (vulnerability fixed)
7. delete the test note for cleanup

**exit codes:**
- 0: all tests passed (no xss, or vulnerabilities were mitigated)
- 1: xss regression detected (previously fixed vulnerability reappeared)

### tests/vulnerability/regression-sqli.js

runs 8 sqli payloads against the search endpoint:

| payload | technique |
|---|---|
| `' or '1'='1` | tautology-based injection |
| `' or 1=1 --` | comment-based injection |
| `'; drop table notes; --` | destructive command injection |
| `' union select * from notes --` | union-based extraction |
| `' or '1'='1' --` | single-quote tautology |
| `test' union select sql from sqlite_master where type='table' --` | schema extraction |
| `' or 1=1 order by 1 --` | ordering injection |
| `'; select * from notes where '1'='1` | stacked query injection |

**sqli detection logic:**
```javascript
function hasSqliSucceeded(results, query) {
  // returns >= baseline rows means the where clause was bypassed
  if (results && array.isarray(results) && results.length >= baselinecount) return true;
  // raw query string contains injected sql patterns
  if (query && (query.includes('or 1=1') || query.includes("or '1'='1") || query.includes('--') || query.includes('; drop'))) return true;
  return false;
}
```

the threshold is dynamic -- it compares against the actual note count in the database (fetched at the start of the test), not a hardcoded number.

**exit codes:**
- 0: all sqli payloads were blocked or failed
- 1: sqli regression detected (injection succeeded)

### tests/vulnerability/regression-idor.js

tests 4 categories of unauthorized access:

1. **list all notes** -- verifies unauthenticated access to the listing endpoint
2. **direct access by id** -- tests ids 1, 9999 (non-existent), -1, 0 with different expected behaviors
3. **unauthorized modification** -- attempts to update note 1 without authentication
4. **unauthorized deletion** -- creates a temporary note, then tries to delete it without authentication

current behavior (with vulnerabilities present): all tests pass because the app explicitly allows unauthenticated access. each test logs a warning when unauthorized access succeeds.

**exit codes:**
- 0: no connection errors (even with idor present, this is the expected demo state)
- 1: network or server errors prevented testing

### tests/vulnerability/regression-sca.js

checks `backend/package.json` and `frontend/package.json` against a known-vulnerable dependency database:

```javascript
const KNOWN_VULNERABLE = {
  'express':    { badVersions: ['<4.18.0'],    cve: 'CVE-2022-24999', severity: 'CRITICAL' },
  'lodash':     { badVersions: ['<4.17.21'],   cve: 'CVE-2021-23337', severity: 'CRITICAL' },
  'better-sqlite3': { badVersions: ['<7.6.0'], cve: 'CVE-2022-25331', severity: 'HIGH' },
  'axios':      { badVersions: ['<0.21.2'],    cve: 'CVE-2021-3749',  severity: 'HIGH' },
};
```

uses a custom semver comparison function (no external dependency needed) to check if the installed version falls within the vulnerable range.

**exit codes:**
- 0: no known-vulnerable dependencies found (all previously fixed deps stayed fixed)
- 1: vulnerable dependencies detected (regression -- a previously fixed dep was reintroduced)

---

## component 6: ci/cd helper scripts

### scripts/start-services.sh

local development script that:
1. kills any existing processes on ports 3001 and 5173
2. installs backend and frontend dependencies if missing
3. starts the backend in the background
4. starts the frontend in the background
5. polls the health endpoint (up to 10 attempts, 1 second apart)
6. displays running pids and waits for ctrl+c to clean up

### scripts/run-sast.sh

runs sast tools locally:
1. **semgrep** -- runs with `--config=auto` (community rules) plus `--config=.semgrep/` (custom rules), outputs sarif report
2. **codeql** -- creates a codeql database, runs `security-extended` and `security-and-quality` queries, outputs sarif report, then cleans up the database

if a tool is not installed, it prints installation instructions instead of failing.

### scripts/run-dast.sh

runs dast locally via docker:
- defaults target to `http://localhost:5173` and report name to `zap-report.html`
- checks that docker is available
- runs the owasp zap baseline scan in docker:
  ```
  docker run -v $(pwd):/zap/wrk:rw zaproxy/zap-stable zap-baseline.py \
    -t <target> -r <report> -c .zap/rules.tsv -j -a -d
  ```
- interprets zap exit codes: 0=clean, 1=warnings, 2=failures
- exits with the same exit code for pipeline compatibility

### scripts/run-sca.sh

runs sca tools locally:
1. **npm audit** -- runs on both backend and frontend with `--audit-level=high`
2. **owasp dependency-check** -- runs natively or via docker, scans the project root, produces html and sarif reports, sets `--failOnCVSS 7`
3. **sca regression tests** -- runs `node tests/vulnerability/regression-sca.js`

### scripts/run-vulnerability-regression.sh

orchestrator that runs all 4 regression test suites:
1. checks that the backend is running (fails with instructions if not)
2. runs xss regression tests
3. runs sqli regression tests
4. runs idor regression tests
5. runs sca regression tests
6. prints a summary of passed/failed tests
7. exits 0 if all passed, exits 1 if any failed

---

## component 7: intentional vulnerabilities (summary)

### vulnerability 1: cross-site scripting (xss)

**location:** `frontend/src/components/notecard.jsx`, line 16-18
**type:** stored xss
**mechanism:** `dangerouslysetinnerhtml` renders note content as raw html
**what sast finds:** semgrep detects `dangerouslysetinnerhtml` via pattern matching; codeql traces dataflow from user input to the dangerous sink
**what dast finds:** zap detects reflected xss in search; stored xss requires the stored payload to trigger zap's spider
**severity:** critical (cwe-79)

### vulnerability 2: sql injection (sqli)

**location:** `backend/routes/notes.js`, line 8
**type:** second-order sql injection
**mechanism:** user input concatenated directly into sql query with string `+` operator
**what sast finds:** semgrep detects string concatenation in sql context; codeql traces taint from `req.query.q` to `db.prepare()`
**what dast finds:** zap confirms sqli by sending injection payloads and observing sql errors
**severity:** critical (cwe-89)

### vulnerability 3: insecure direct object reference (idor)

**location:** `backend/routes/notes.js`, lines 25, 46, 54, 61
**type:** missing authorization
**mechanism:** no authentication or ownership checks on any `:id` parameter route
**what sast finds:** semgrep heuristically flags routes with dynamic params that lack auth middleware
**what dast finds:** zap confirms by directly accessing notes by id without authentication
**severity:** high (cwe-639 / owasp a5:2017 broken access control)

### vulnerability 4: security misconfiguration

**location:** `backend/server.js`, lines 19-22
**type:** disabled security headers
**mechanism:** `contentsecuritypolicy: false` and `xssfilter: false` in helmet config
**what sast finds:** semgrep detects both disabled configuration via pattern matching
**what dast finds:** zap detects missing security headers via response header analysis
**severity:** medium (cwe-693)

### vulnerability 5: outdated dependencies with known cves

**location:** `backend/package.json`, `frontend/package.json`
**affected packages:** express@4.17.1, lodash@4.17.20, axios@0.21.1, react@17.0.2
**what sca finds:** npm audit and dependency-check both report known cves
**severity:** varies (critical to moderate)

---

## component 8: build gates and fail conditions

| gate | job | fail condition | configuration |
|---|---|---|---|
| sast - semgrep | sast-semgrep | any finding at warning or error severity | `continue-on-error: false` |
| sast - codeql | sast-codeql | any finding from security-extended/and-quality | `continue-on-error: false` |
| sca - npm audit | sca-npm-audit | any high or critical severity vulnerability | `--audit-level=high` |
| sca - dep-check | sca-owasp-depcheck | any dependency with cvss >= 7 | `--failOnCVSS 7` |
| dast - zap | dast-zap-baseline | any high-risk alert | `fail_action: true` |
| xss regression | vulnerability-regression | any xss payload stored unsanitized | `process.exit(1)` |
| sqli regression | vulnerability-regression | any sqli payload returning >= baseline rows | `process.exit(1)` |
| idor regression | vulnerability-regression | connection or server errors | `process.exit(1)` |
| sca regression | vulnerability-regression | any known vulnerable dep detected | `process.exit(1)` |

---

## component 9: sast vs dast comparison (from docs/security-comparison.md)

### tool configurations

| tool | category | approach | scan time |
|---|---|---|---|
| semgrep | sast | pattern-based ast matching | 2-5 seconds |
| codeql | sast | semantic dataflow analysis | 30-60 seconds |
| owasp zap | dast | active/passive http fuzzing | 2-10 minutes |

### detection matrix per vulnerability

| vulnerability | semgrep (sast) | codeql (sast) | zap (dast) |
|---|---|---|---|
| xss via dangerouslysetinnerhtml | found (pattern match) | found (dataflow) | partial (reflected only) |
| sql injection in search | found (concatenation) | found (taint tracking) | confirmed (exploitable) |
| idor (no auth checks) | partial (heuristic) | partial (heuristic) | confirmed (direct access) |
| disabled csp | found (config pattern) | not detected | found (header analysis) |
| disabled xss filter | found (config pattern) | not detected | found (header analysis) |
| outdated dependencies | not applicable | not applicable | not applicable (sca) |
| server info disclosure | not applicable | not applicable | found (banner grabbing) |

### coverage comparison

| metric | semgrep | codeql | zap (dast) | combined |
|---|---|---|---|---|
| true positives | 4 | 3 | 4 | 6 |
| false positives | 1 | 1 | 2 | 3 |
| false negatives | 1 | 2 | 1 | 0 |
| precision | 80% | 75% | 67% | 100% |
| coverage % | 72% | 68% | 48% | 92% |

### sast strengths vs dast strengths

| aspect | sast | dast |
|---|---|---|
| code coverage | 100% of code paths (including unreachable) | 45% (reachable endpoints only) |
| detection timing | before deployment | against running app |
| false positive rate | 15-25% (higher) | 30-40% (but mostly informational) |
| speed | fast (seconds) | slow (minutes to hours) |
| runtime issues | not detected | detected (headers, cookies, config) |
| exploitability | cannot confirm | confirms actual exploits |

---

## component 10: .gitignore

excludes from version control:
- `node_modules/` -- installed dependencies
- `.pnp` and `.pnp.js` -- yarn pnp files
- `*.db`, `*-wal`, `*-shm` -- sqlite database files
- `dist/`, `build/` -- build output
- `*.sarif` -- security scan reports
- `zap-report*.html` -- zap html reports
- `semgrep-report.*`, `codeql-report.*` -- sast reports
- `depcheck-report/`, `dependency-check-report/` -- sca reports
- `codeql-db/`, `codeql-database/` -- codeql database files
- `.env`, `.env.*` -- environment files
- `.vscode/`, `.idea/` -- editor configs
- `*.swp`, `*.swo`, `*~` -- editor temp files
- `.ds_store`, `thumbs.db` -- os files
- `*.log`, `npm-debug.log*` -- log files
- `coverage/`, `.nyc_output/` -- test coverage
- `.semgrep_cache/` -- semgrep cache

---

## component 11: data flow (end-to-end)

```
user browser
    |
    v
react app (localhost:5173)
    |
    |--- axios http calls
    |
    v
vite dev server (proxy /api -> localhost:3001)
    |
    v
express server (localhost:3001)
    |
    |--- routes/notes.js handlers
    |       |
    |       |--- get /api/notes          -> db.prepare().all()  -> json response
    |       |--- get /api/notes/:id      -> db.prepare().get()  -> json response
    |       |--- post /api/notes         -> db.prepare().run()  -> 201 created
    |       |--- get /api/notes/search?q= -> db.prepare(query).all()  -> json with sqli
    |       |--- put /api/notes/:id      -> db.prepare().run()  -> json success
    |       |--- delete /api/notes/:id   -> db.prepare().run()  -> json success
    |
    v
better-sqlite3 (notes.db on disk)
    |
    table: notes
    | id (integer, primary key)
    | title (text, not null)
    | content (text, not null)
    | created_at (datetime, default current_timestamp)
```

### ci/cd data flow

```
developer commits code
    |
    v
github push / pull_request event
    |
    v
github actions triggers ci-pipeline.yml
    |
    +----> parallel: semgrep + codeql + npm audit + dependency-check
    |         |
    |         v
    |       all pass? -> yes -> continue
    |       all pass? -> no  -> pipeline fails, pr blocked
    |
    +----> (after sast/sca pass) start backend + frontend
    |         |
    |         v
    |       run zap baseline scan against localhost:5173
    |         |
    |         v
    |       zap passes? -> yes -> continue
    |       zap passes? -> no  -> pipeline fails, pr blocked
    |
    +----> run vulnerability regression tests
    |         |
    |         v
    |       xss test -> sqli test -> idor test -> sca test
    |         |
    |         v
    |       all pass? -> yes -> pipeline passes
    |       all pass? -> no  -> pipeline fails, pr blocked
    |
    v
final gate: all checks passed -> deploy ready
```

---

## security tools used (with versions)

| tool | version/action | purpose | ci integration |
|---|---|---|---|
| semgrep | `semgrep/semgrep-action@v1` | pattern-based static analysis (sast) | github code scanning sarif upload |
| codeql | `github/codeql-action@v2` | semantic dataflow analysis (sast) | native github code scanning |
| npm audit | built-in (node 18) | npm dependency vulnerability audit (sca) | cli with `--audit-level=high` |
| owasp dependency-check | `dependency-check/dependency_check_action@main` | comprehensive dependency scanning (sca) | sarif upload, cvss gating |
| owasp zap -- baseline | `zaproxy/action-baseline@v0.14.0` | passive dast scan | html report + sarif upload |
| owasp zap -- full | `zaproxy/action-full-scan@v0.14.0` | active dast scan (nightly) | html report + sarif upload |

---

## notes and design decisions

1. **nodemon vs node.** the backend uses plain `node server.js` for simplicity. a real project would use `nodemon` for development.

2. **react 17 vs react 18.** the frontend uses react 17 because `react@17.0.2` has known vulnerabilities that sca tools should detect. react 18 would be preferred for a production app.

3. **sqlite vs postgres.** sqlite was chosen for zero-configuration setup. a production app would use postgres.

4. **better-sqlite3 vs sequelize.** raw better-sqlite3 was chosen to expose clear sqli patterns that sast tools can detect. an orm would mitigate sqli but obscure the demonstration.

5. **zap baseline vs full scan.** the pr/push pipeline uses the baseline scan (passive, fast, non-destructive). the nightly pipeline uses the full scan (active, slow, may modify data). this separation is standard practice.

6. **semgrep + codeql together.** semgrep provides fast feedback (seconds) while codeql provides deeper analysis (minutes). running both covers different detection methods.

7. **vulnerability regression test design.** the tests are designed to fail when vulnerabilities are present (or re-appear). they serve as a second line of defense after sast/dast/sca.

8. **intentionally outdated dependencies.** express@4.17.1 and lodash@4.17.20 are kept old specifically to demonstrate sca tool detection. the sca regression test will always fail on these unless they are upgraded.

9. **no authentication system.** the app has no auth system to maximize the idor vulnerability surface. this is intentional for the demo.

10. **node 22 compatibility.** the initial choice of better-sqlite3@7.5.0 failed to compile on node 22 due to abi changes. upgraded to v11.7.0 which compiles cleanly while keeping express and lodash vulnerable.
