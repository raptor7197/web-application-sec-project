# devsecops pipeline for web application security report

## declaration and ethical-use statement

this project was prepared only for academic and defensive security learning. the notes application is intentionally vulnerable and must be tested only in a local lab or an approved training environment. no production system, third-party service, or unauthorized network should be scanned or attacked using this project. all findings, payloads, and scripts in this report are used to demonstrate secure coding, automated testing, and responsible vulnerability management.

## table of contents

1. [introduction](#1-introduction)  
2. [literature and background study](#2-literature-and-background-study)  
3. [problem statement and scope](#3-problem-statement-and-scope)  
4. [system under test and architecture](#4-system-under-test-and-architecture)  
5. [threat model and security requirements](#5-threat-model-and-security-requirements)  
6. [methodology](#6-methodology)  
7. [implementation and experiments](#7-implementation-and-experiments)  
8. [results and analysis](#8-results-and-analysis)  
9. [limitations](#9-limitations)  
10. [contemporary issues](#10-contemporary-issues)  
11. [conclusion and future work](#11-conclusion-and-future-work)  
12. [individual contributions](#12-individual-contributions)  
13. [references](#13-references)  
14. [appendices](#14-appendices)  

## required project details

### scenario number and problem statement

scenario number: scenario 1, devsecops pipeline for a vulnerable notes web application.

the project studies a full-stack notes application that accepts untrusted user input through a browser and rest api, stores that input in a sqlite database, and renders it back to users. the core security problem is that common web application weaknesses can enter a project through source code, dependencies, and runtime configuration, then remain unnoticed until release if the team depends only on manual review. this scenario demonstrates five risk groups: stored cross-site scripting from raw html rendering, sql injection from unsafe query construction, insecure direct object reference from missing authorization checks, security misconfiguration from disabled browser protections, and vulnerable dependencies from pinned outdated packages. the project response is a devsecops pipeline that combines static application security testing, software composition analysis, dynamic application security testing, and vulnerability regression tests so unsafe builds are detected and blocked before deployment.

### team role split

replace the placeholder names with actual team member names in the final submission.

| role | owner | responsibilities | key files or outputs |
|---|---|---|---|
| frontend owner | member 1 | owns the react and vite user interface, note creation form, search interface, note rendering behavior, client-side api calls, and ui evidence screenshots | `frontend/src/app.jsx`, `frontend/src/api.js`, `frontend/src/components/notecard.jsx`, ui screenshot |
| backend owner | member 2 | owns the express server, rest endpoints, sqlite schema, seed data, middleware, error handling, and endpoint documentation | `backend/server.js`, `backend/db.js`, `backend/routes/notes.js` |
| exploit owner | member 3 | validates the vulnerable behavior using xss payloads, sql injection payloads, direct object access by id, zap scan output, and dependency scan results | `tests/vulnerability/regression-xss.js`, `tests/vulnerability/regression-sqli.js`, `tests/vulnerability/regression-idor.js`, zap report |
| defence owner | member 4 | owns the defended design, scanner rules, ci gates, dependency upgrade plan, secure coding fixes, and verification strategy | `.semgrep/notes-app.yaml`, `.github/workflows/ci-pipeline.yml`, scripts under `scripts/` |
| report owner | member 5 | owns the final markdown or word report, architecture diagram, endpoint inventory, literature survey, findings summary, references, and appendices | `project-report.md`, screenshots, scanner evidence |

### architecture diagram with auth flow and trust boundaries

figure 1: system architecture, current authentication state, and trust boundaries.

```mermaid
flowchart tb
  actor[unauthenticated user or tester]

  subgraph tb1[trust boundary 1: user device]
    browser[browser]
  end

  subgraph tb2[trust boundary 2: frontend runtime]
    frontend[react 17 and vite frontend on port 5173]
    apiclient[axios api client]
  end

  subgraph tb3[trust boundary 3: public http api]
    proxy[vite /api proxy]
    backend[express api on port 3001]
    middleware[cors, morgan, express json, helmet with csp disabled]
    routes[notes routes]
  end

  subgraph tb4[trust boundary 4: server-side data access]
    dbmodule[better-sqlite3 db module]
    database[(sqlite notes.db)]
  end

  subgraph tb5[trust boundary 5: ci security environment]
    pipeline[github actions pipeline]
    sast[semgrep and codeql]
    sca[npm audit and dependency-check]
    dast[owasp zap]
    regression[vulnerability regression tests]
    gate[build gate]
  end

  actor -->|http get/post/put/delete| browser
  browser --> frontend
  frontend --> apiclient
  apiclient -->|/api requests| proxy
  proxy --> backend
  backend --> middleware
  middleware --> routes
  routes --> dbmodule
  dbmodule --> database

  actor -.->|auth flow requested| authmissing[no login, no token, no session, no role check]
  authmissing -.-> routes

  pipeline --> sast
  pipeline --> sca
  pipeline --> dast
  pipeline --> regression
  sast --> gate
  sca --> gate
  dast --> gate
  regression --> gate
  dast -->|runtime scan| frontend
```

trust boundary explanation:

| boundary | crossing | risk introduced | required control |
|---|---|---|---|
| trust boundary 1 | user to browser | user can submit malicious note text and search input | client-side validation for usability, server-side validation for security |
| trust boundary 2 | browser frontend to api client | frontend sends untrusted data to backend | encode requests, avoid trusting frontend-only checks |
| trust boundary 3 | frontend proxy to express api | unauthenticated http requests reach server routes | authentication, authorization, rate limits, strict headers |
| trust boundary 4 | api route to database | route input becomes database query or stored content | parameterized queries, schema constraints, output encoding |
| trust boundary 5 | repository to ci pipeline | code and dependencies are evaluated before release | sast, sca, dast, regression gates |

auth flow status:

| step | expected secure auth flow | current project behavior | security impact |
|---|---|---|---|
| 1 | user submits credentials to auth endpoint | no auth endpoint exists | every user is anonymous |
| 2 | backend validates credentials | no credential store exists | identity cannot be proven |
| 3 | backend issues session cookie or bearer token | no session or token exists | requests carry no authenticated principal |
| 4 | frontend sends session on api calls | api calls are anonymous | no user-level access control is possible |
| 5 | backend checks resource ownership | no ownership column or check exists | any note id can be read, updated, or deleted |

### attack-surface inventory

| method | path | parameters | auth required | data sensitivity | attack surface and notes |
|---|---|---|---|---|---|
| get | `/api/health` | none | n | low | returns service status and timestamp; useful for health checks but can confirm that the backend is alive |
| get | `/api/notes` | none | n | medium | returns all notes; because there is no auth, it exposes every stored note to any caller |
| get | `/api/notes/search` | query `q` | n | medium | accepts untrusted search input; current implementation concatenates `q` into sql and returns the generated query in responses |
| get | `/api/notes/:id` | path `id` | n | medium | direct object lookup; missing auth and ownership checks allow id enumeration |
| post | `/api/notes` | json body `title`, `content` | n | medium | creates notes with raw user-controlled content; stored xss is possible when content is rendered |
| put | `/api/notes/:id` | path `id`, json body `title`, `content` | n | medium to high | modifies any note id without authentication; integrity risk |
| delete | `/api/notes/:id` | path `id` | n | high | deletes any note id without authentication; availability and integrity risk |
| get | `/` in production mode | static frontend route | n | low | serves the built frontend when `node_env` is production |
| get | frontend dev server on `5173` | browser route and static assets | n | low to medium | vite dev server exposure matters because old vite versions have file access cves when exposed beyond localhost |

### literature and cve survey

the survey uses public standards and vulnerability records to connect this project to known weakness classes. cve means common vulnerabilities and exposures. it is a public catalogue that assigns one unique id to each publicly disclosed security flaw, so teams, tools, vendors, and reports can refer to the same bug consistently. the required id format is `CVE-YYYY-NNNNN`, for example `CVE-2021-44228`.

| source | relevance to this project | detail used in the project |
|---|---|---|
| owasp top 10 | maps the project to major web risk categories | broken access control, injection, security misconfiguration, vulnerable components, and authentication failures |
| owasp web security testing guide | supports the methodology | reconnaissance, input validation testing, auth testing, authorization testing, and configuration review |
| cwe | maps findings to weakness classes | cwe-79 for xss, cwe-89 for sql injection, cwe-639 for idor, cwe-693 for protection mechanism failure |
| cvss | supports severity discussion | high and medium findings are described using risk impact and scanner gates |
| nvd and github advisories | provide package cve evidence | used to justify sca findings for lodash, qs or express, axios, and vite |

package and cve survey:

| cve id | affected component in this project | installed version | affected range from public advisory | weakness and impact | project relevance | recommended action |
|---|---|---:|---|---|---|---|
| CVE-2022-24999 | express dependency chain through `qs` | express `4.17.1` | affected `qs` versions before the patched express release path | uncontrolled query parsing can lead to denial of service conditions | relevant because the backend pins old express and accepts http query strings | upgrade express to a current supported release and refresh lockfile |
| CVE-2021-23337 | lodash | `4.17.20` | lodash versions before `4.17.21` | code injection through lodash template handling | relevant as an sca finding; direct exploitability depends on whether unsafe lodash template usage is reachable | upgrade lodash to `4.17.21` or later |
| CVE-2021-3749 | axios | `0.21.1` | axios versions up to and including `0.21.1` | inefficient regular expression or comparison issue causing availability impact | relevant because the frontend pins the affected axios version | upgrade axios to a maintained current release |
| CVE-2022-35204 | vite | `2.9.0` | vite versions before `2.9.13` | directory traversal through crafted dev-server url | relevant if the vite dev server is exposed beyond localhost; lower risk in local-only lab | upgrade vite to at least `2.9.13`, preferably a current supported major version |
| CVE-2023-34092 | vite | `2.9.0` | vite versions before `2.9.16`, `3.2.7`, `4.0.5`, `4.1.5`, `4.2.3`, and `4.3.9` | `server.fs.deny` bypass may expose files from the project root | relevant if the vite dev server is bound to a reachable network interface | upgrade vite beyond the fixed version and keep dev server bound to localhost |

application weakness survey:

| weakness | project evidence | public classification | likely severity in this lab | defended design |
|---|---|---|---|---|
| stored xss | note content is rendered with dangerous html binding | cwe-79 and owasp injection-related client risk | high | escape content by default or sanitize html with a strict allowlist |
| sql injection | search route builds sql using string concatenation | cwe-89 and owasp injection | high | use prepared statements with placeholders for all user input |
| idor | get, put, and delete note-by-id routes lack auth and ownership checks | cwe-639 and owasp broken access control | high | add authentication, user ids, ownership checks, and `403` responses |
| security misconfiguration | helmet csp and xss filter are disabled | cwe-693 and owasp security misconfiguration | medium | enable helmet defaults and define a strict csp |
| vulnerable dependencies | package manifests pin old dependencies | owasp vulnerable and outdated components | high | upgrade packages and enforce sca gates in ci |

## abstract

this report presents a full-stack notes application used to demonstrate web application security testing inside a devsecops pipeline. the target system has a react and vite frontend, an express backend, and a sqlite database. the vulnerability classes studied are cross-site scripting, sql injection, insecure direct object reference, security misconfiguration, and vulnerable dependencies. the methodology combines source review, endpoint inspection, static testing, dynamic testing, software composition analysis, and vulnerability regression tests. the main tools are semgrep, codeql, npm audit, owasp dependency-check, owasp zap, and custom node-based regression scripts. the vulnerable build contains five main issue groups: stored cross-site scripting, sql injection, missing authorization, disabled browser security controls, and outdated packages. the implemented countermeasure in this repository is an automated security pipeline with build gates and regression tests; application-level fixes are documented as the defended target state. the major limitation is that the checked-out app remains intentionally vulnerable for demonstration.

keywords: web application security, devsecops, xss, sql injection, idor, sca

## 1. introduction

### 1.1 background

web application security protects applications that receive untrusted browser and api input. the key areas in this project are injection, cross-site scripting, broken access control, dependency security, security misconfiguration, and automated vulnerability management. the project uses an intentionally vulnerable notes app so scanners and tests can detect real weakness patterns in code, dependencies, and runtime behavior.

### 1.2 motivation

small web applications often ship with unsafe defaults, missing authorization checks, and outdated dependencies. these issues can expose user data, allow account takeover, corrupt stored records, or stop a service from working. public incidents in this category commonly involve injection, leaked tokens, vulnerable packages, and weak access control. this project matters because it shows how a pipeline can catch these risks before release.

### 1.3 objectives of the project

- build a full-stack notes application with realistic vulnerable patterns.
- detect xss, sql injection, idor, misconfiguration, and dependency risk using automated tools.
- compare static, dynamic, and composition-based security testing.
- add build gates so high-risk findings block unsafe releases.
- create regression tests that prevent known vulnerability classes from returning.

### 1.4 scope of the report

section 2 covers standards, concepts, and related tools. section 3 defines the security problem and scope. section 4 describes the app, architecture, endpoints, database, and lab setup. section 5 gives the threat model and requirements. section 6 explains the testing workflow. section 7 records the vulnerable build, findings, defended target state, and test cases. section 8 analyzes results. sections 9 to 14 cover limitations, current issues, conclusion, contributions, references, and appendices.

## 2. literature and background study

### 2.1 related concepts and standards

the project maps to the owasp top 10 categories for broken access control, injection, security misconfiguration, vulnerable and outdated components, and identification and authentication failures. the owasp web security testing guide supports the test workflow for discovery, input validation, authentication, authorization, and configuration review. cwe is used to map issues to weakness classes such as cwe-79 for cross-site scripting, cwe-89 for sql injection, cwe-639 for insecure direct object reference, and cwe-693 for protection mechanism failure. cvss is used to describe severity using a repeatable scoring model. hoffman's web application security text supports the attack-and-defense framing for modern web app vulnerabilities.

### 2.2 related work / existing solutions

| ref | approach / tool | strengths | limitations |
|---|---|---|---|
| [1] | owasp top 10 | clear web risk categories | awareness list, not a full test plan |
| [2] | owasp web security testing guide | practical testing structure | requires tester judgment |
| [3] | cwe | precise weakness taxonomy | does not measure exploitability alone |
| [4] | cvss | consistent severity scoring | score quality depends on accurate context |
| [5] | semgrep and codeql | early source-level detection | false positives and missed runtime context |
| [6] | owasp zap | runtime validation through http scanning | limited by crawl depth and auth setup |

### 2.3 gap identified

many demos show either vulnerable code or a scanner result, but not the full feedback loop. this project demonstrates a complete local devsecops flow: vulnerable app, static scanning, dependency scanning, dynamic scanning, regression tests, and ci build gates.

## 3. problem statement and scope

### 3.1 problem definition

the project demonstrates how a full-stack notes application can contain exploitable web vulnerabilities and how automated security checks can detect and block those issues in a development pipeline.

### 3.2 in-scope and out-of-scope

in scope:

- notes frontend and backend source code.
- api endpoints under `/api/notes` and `/api/health`.
- sqlite notes database used by the backend.
- xss, sql injection, idor, security misconfiguration, and vulnerable dependencies.
- local scripts and github actions pipeline design.
- scanner comparison across sast, dast, and sca.

out of scope:

- production deployment.
- cloud infrastructure security.
- payment, email, or external service integrations.
- mobile clients.
- social engineering.
- destructive testing against real systems.
- full authentication design beyond the recommended defended state.

### 3.3 assumptions and constraints

- attacker model: unauthenticated outsider.
- access level: white-box, because source code is available.
- environment: local lab on localhost.
- backend port: `3001`.
- frontend port: `5173`.
- database: local sqlite file in the backend folder.
- constraint: no production testing.
- constraint: some tools require local installation or docker.
- constraint: the checked-out application remains intentionally vulnerable.

## 4. system under test and architecture

### 4.1 application overview

the system is a notes application. users can create notes, list notes, search notes, expand note cards, update notes through the api, and delete notes. there is no authentication or role model in the current build. the frontend shows all notes and search results. the backend exposes rest-style json endpoints. screenshot evidence should be captured from `http://localhost:5173` after running the services.

### 4.2 architecture diagram

figure 1: application and pipeline architecture.

```mermaid
flowchart tb
  user[user browser] --> frontend[react and vite frontend]
  frontend -->|http proxy /api| backend[express api]
  backend --> database[(sqlite notes database)]

  developer[developer commit] --> pipeline[github actions pipeline]
  pipeline --> sast[sast: semgrep and codeql]
  pipeline --> sca[sca: npm audit and dependency-check]
  pipeline --> dast[dast: zap baseline]
  pipeline --> regression[vulnerability regression tests]
  sast --> gate[build gate]
  sca --> gate
  dast --> gate
  regression --> gate

  subgraph trust_boundary_1[client trust boundary]
    user
    frontend
  end

  subgraph trust_boundary_2[server trust boundary]
    backend
    database
  end
```

### 4.3 frontend description

| item | detail |
|---|---|
| framework | react `17.0.2` |
| bundler | vite `2.9.0` |
| plugin | vite react plugin `1.2.0` |
| http client | axios `0.21.1` |
| main pages | single page notes interface |
| main components | app, note form, note list, note card |
| state | react hooks for notes, search, loading, errors, active tab |
| sessions | no login session |
| client storage | no localstorage, sessionstorage, indexeddb, or cookies used by app code |
| key risk | raw note html is rendered using dangerous html binding |

### 4.4 backend description

| item | detail |
|---|---|
| runtime | node.js `18` in ci |
| framework | express `4.17.1` |
| database library | better-sqlite3 `11.7.0` |
| middleware | cors, morgan, express json, helmet |
| api style | rest-style json |
| server port | `3001` |
| production serving | serves frontend build when production mode is enabled |
| key risk | missing auth, unsafe search query, disabled csp and xss filter |

endpoint inventory:

| method | path | parameters | auth? | data sensitivity |
|---|---|---|---|---|
| get | `/api/health` | none | no | low |
| get | `/api/notes` | none | no | medium, all note data |
| get | `/api/notes/search` | query `q` | no | medium, search results and raw query |
| get | `/api/notes/:id` | path `id` | no | medium, single note |
| post | `/api/notes` | body `title`, `content` | no | medium, creates stored content |
| put | `/api/notes/:id` | path `id`, body `title`, `content` | no | medium, modifies note |
| delete | `/api/notes/:id` | path `id` | no | medium, deletes note |

### 4.5 data stores

the backend uses sqlite through better-sqlite3. the database file is `notes.db` in the backend folder. the schema has one table:

```sql
create table if not exists notes (
  id integer primary key autoincrement,
  title text not null,
  content text not null,
  created_at datetime default current_timestamp
);
```

sensitive data in the demo is limited to note titles and note content. seed data includes an api-key reminder note and intentionally unsafe html content. no password store exists. no secrets are required for the local app.

### 4.6 lab setup and tools

| tool | purpose | version or source |
|---|---|---|
| node.js | runtime and test execution | `18` in ci |
| npm | dependency install and audit | bundled with node |
| semgrep | sast | action and local cli |
| codeql | sast | github codeql action |
| npm audit | sca | npm command |
| owasp dependency-check | sca | action or local cli |
| owasp zap | dast | baseline and full scan actions |
| docker | local zap and dependency-check fallback | required for local containers |
| curl | health checks | system tool |
| browser devtools | manual request and ui inspection | browser built-in |

reproduction:

```bash
cd backend
npm install
node server.js
```

```bash
cd frontend
npm install
npm run dev
```

open `http://localhost:5173`. the backend health endpoint is `http://localhost:3001/api/health`.

## 5. threat model and security requirements

### 5.1 assets to protect

- note titles and content.
- database integrity.
- api availability.
- dependency supply chain.
- browser execution context.
- scanner reports and pipeline status.
- future credentials and session tokens if auth is added.

### 5.2 threat actors

- unauthenticated outsider using the public api.
- low-skill attacker replaying common xss and sql payloads.
- dependency attacker exploiting known vulnerable packages.
- malicious or careless developer reintroducing unsafe code.
- automated crawler or scanner probing endpoints.

### 5.3 threat enumeration

| threat | attack path | impact |
|---|---|---|
| stored xss | submit html or script as note content | script runs in another user's browser |
| sql injection | inject payload into search query | data disclosure or database errors |
| idor | guess note ids | read, update, or delete other notes |
| misconfiguration | disabled csp and weak headers | weaker browser-side protection |
| vulnerable dependency | exploit old package | denial of service, ssrf, or pollution risk |
| missing auth | call api directly | no identity or ownership checks |

### 5.4 security requirements

- reject or sanitize dangerous html before storage or rendering.
- use parameterized sql for every query.
- require authentication before note access.
- enforce per-note authorization for read, update, and delete.
- enable strict csp and standard security headers.
- keep dependencies above known vulnerable versions.
- fail ci on high or critical findings.
- maintain regression tests for fixed vulnerability classes.

### 5.5 success criteria

- sast flags unsafe html binding, sql concatenation, missing auth patterns, and disabled headers.
- sca flags outdated vulnerable packages.
- dast identifies runtime security issues in the running app.
- regression tests fail when a known vulnerability exists and pass after remediation.
- the final build gate blocks release when any required security job fails.

## 6. methodology

### 6.1 reconnaissance

the project structure, package manifests, routes, frontend components, database schema, scanner configuration, ci workflows, and regression tests were reviewed. the api surface was identified from backend routing and the frontend client.

### 6.2 vulnerability identification

static review found raw html rendering in the note card, string-built sql in the search route, unauthenticated dynamic note routes, disabled helmet csp, disabled xss filter, and outdated dependencies. custom semgrep rules encode these patterns. codeql is configured for javascript security and quality queries.

### 6.3 exploitation

the intended exploitation paths are:

- create a note containing script-like html and render it in the browser.
- search with sql payloads such as boolean conditions or union-style strings.
- request, update, or delete notes by id without credentials.
- scan runtime headers with zap.
- scan package files for known vulnerable versions.

### 6.4 remediation

pipeline-level remediation is implemented through ci gates, sast, sca, dast, and regression tests. application-level remediation is the defended target state:

- replace dangerous html rendering with escaped text or sanitized html.
- change search to parameterized sql.
- add authentication and ownership checks.
- enable helmet csp.
- upgrade vulnerable dependencies.
- remove raw query disclosure from error responses.

### 6.5 verification

verification is designed through four regression suites: xss, sql injection, idor, and dependency checks. the ci pipeline also verifies semgrep, codeql, npm audit, dependency-check, and zap results. in the current repository state, these checks are expected to report or fail because the app intentionally contains vulnerabilities.

## 7. implementation and experiments

### 7.1 vulnerable build

| area | vulnerable behavior | location |
|---|---|---|
| xss | note content is rendered as raw html | note card component |
| sql injection | search input is concatenated into sql | notes search route |
| idor | note routes have no auth or ownership check | notes api routes |
| misconfiguration | csp and xss filter disabled | express server setup |
| dependency risk | old express, lodash, axios, vite versions | package manifests |

### 7.2 findings

| id | finding | class | severity | evidence |
|---|---|---|---|---|
| f1 | stored xss through raw note content | cwe-79 | high | dangerous html binding in note card |
| f2 | sql injection in search | cwe-89 | high | string-built sql query using request input |
| f3 | insecure direct object reference | cwe-639 | high | no auth on get, put, and delete by id |
| f4 | disabled browser security controls | cwe-693 | medium | helmet csp and xss filter disabled |
| f5 | vulnerable and outdated components | owasp a06 | high | express, lodash, axios, and vite versions |

### 7.3 defended build

the repository currently implements the defended pipeline, not a fully remediated application build. the defended target build should contain:

| weakness | defended change | expected result |
|---|---|---|
| xss | escape text or sanitize html with an allowlist | payload stored or shown without script execution |
| sql injection | use placeholders for search terms | payload treated as data |
| idor | add login and note ownership checks | unauthorized ids return `401` or `403` |
| misconfiguration | enable csp and security headers | zap header alerts reduced |
| dependencies | upgrade vulnerable packages | sca high and critical findings removed |

### 7.4 test cases

| test suite | purpose | expected vulnerable result | expected defended result |
|---|---|---|---|
| xss regression | submit unsafe html payloads | fail when unsanitized content is returned | pass after sanitization |
| sql injection regression | search with injection payloads | fail when injection succeeds or raw query is exposed | pass with parameterized query |
| idor regression | access and modify notes without auth | demonstrates unauthenticated access | reject unauthorized access |
| sca regression | scan package versions | fail on known vulnerable dependency versions | pass after upgrades |
| zap baseline | crawl runtime app | report header and runtime issues | reduced high-risk alerts |
| semgrep rules | scan source patterns | flag intended vulnerable code | no matching unsafe patterns |

## 8. results and analysis

### 8.1 findings summary

| category | count | severity |
|---|---:|---|
| xss | 1 | high |
| sql injection | 1 | high |
| broken access control / idor | 1 issue group | high |
| security misconfiguration | 1 issue group | medium |
| vulnerable dependencies | 1 issue group | high |
| total | 5 issue groups | 4 high, 1 medium |

### 8.2 before vs after comparison

| control area | vulnerable state | defended target state |
|---|---|---|
| rendering | raw html rendered | escaped or sanitized output |
| database query | string concatenation | parameterized statements |
| authorization | no auth checks | authenticated ownership checks |
| headers | csp disabled | csp enabled |
| dependencies | known vulnerable versions | upgraded versions |
| pipeline | detects issues | blocks release until fixed |

### 8.3 performance impact of defences

most code-level defences have low runtime cost. parameterized sql has negligible overhead. output sanitization adds small processing cost during create or render. authentication and authorization add a database lookup or token validation per protected request. scanner cost is mostly ci time: semgrep is fast, codeql is slower, zap is slowest, and dependency-check depends on vulnerability database setup.

### 8.4 root-cause analysis

| finding | root cause |
|---|---|
| xss | untrusted note content is trusted at render time |
| sql injection | user input is mixed with sql syntax |
| idor | resources have ids but no identity or ownership model |
| misconfiguration | security headers were weakened for demonstration |
| dependency risk | old package versions were retained for sca demonstration |

### 8.5 discussion

sast gives early feedback because it scans source code before deployment. dast gives runtime confidence because it interacts with the app over http. sca covers the gap that neither sast nor dast handles well: known vulnerable packages. regression tests are useful because they turn security bugs into repeatable checks. the combined approach is stronger than any single tool, but it still requires manual review for business logic and design flaws.

## 9. limitations

- the app has no real user accounts, roles, or session handling.
- the database is local sqlite, not a production database.
- the current code is intentionally vulnerable, so it is not deployable.
- no full manual penetration test is included.
- zap coverage is limited without authenticated crawling.
- dependency results can change as advisories are updated.
- the report does not include a captured ui screenshot asset.

## 10. contemporary issues

modern web security is strongly affected by supply-chain risk, rapid dependency churn, insecure defaults in small apps, and growing use of automated scanners in ci. current practice favors layered controls: source scanning, dependency scanning, runtime scanning, secret scanning, code review, and regression testing. another key issue is scanner fatigue. teams must tune rules and suppress known false positives carefully so real high-risk findings still block releases.

## 11. conclusion and future work

### 11.1 conclusion

the project successfully demonstrates a local full-stack web application with realistic vulnerability classes and a devsecops pipeline that can detect them. the main objectives were met at the pipeline and demonstration level: vulnerable patterns exist, scanners are configured, regression tests are present, and build gates are defined. the main caveat is that the application code itself is intentionally not remediated in this checkout.

### 11.2 future work

- implement the defended application build.
- add authentication with secure session handling.
- add note ownership and authorization middleware.
- sanitize or escape note content.
- upgrade vulnerable packages and lock safe versions.
- add unit tests for route authorization.
- add authenticated zap context.
- add screenshot evidence and scanner reports as appendices.
- add docker compose for one-command reproduction.

## 12. individual contributions

| contributor | contribution |
|---|---|
| project author | built the notes app, backend api, database setup, scanner scripts, ci workflows, and documentation |
| report preparer | reviewed the repository and compiled this structured project report |

## 13. references

[1] owasp foundation, owasp top ten web application security risks, https://owasp.org/www-project-top-ten/  
[2] owasp foundation, web security testing guide, https://owasp.org/www-project-web-security-testing-guide/latest/  
[3] mitre, cwe-79 cross-site scripting, https://cwe.mitre.org/data/definitions/79.html  
[4] mitre, cwe-89 sql injection, https://cwe.mitre.org/data/definitions/89.html  
[5] mitre, cwe-639 authorization bypass through user-controlled key, https://cwe.mitre.org/data/definitions/639.html  
[6] first, common vulnerability scoring system version 3.1, https://www.first.org/cvss/v3.1/specification-document  
[7] semgrep documentation, https://semgrep.dev/docs/  
[8] github codeql documentation, https://codeql.github.com/docs/  
[9] owasp zap project, https://www.zaproxy.org/  
[10] andrew hoffman, web application security: exploitation and countermeasures for modern web applications, o'reilly media, 2020.  
[11] nvd, cve-2022-24999, https://nvd.nist.gov/vuln/detail/CVE-2022-24999  
[12] nvd, cve-2021-23337, https://nvd.nist.gov/vuln/detail/CVE-2021-23337  
[13] nvd, cve-2021-3749, https://nvd.nist.gov/vuln/detail/CVE-2021-3749  
[14] nvd, cve-2022-35204, https://nvd.nist.gov/vuln/detail/CVE-2022-35204  
[15] nvd, cve-2023-34092, https://nvd.nist.gov/vuln/detail/CVE-2023-34092

## 14. appendices

### appendix a: project structure

```text
backend/
  db.js
  package.json
  server.js
  routes/
frontend/
  index.html
  package.json
  vite.config.js
  src/
scripts/
  run-dast.sh
  run-sast.sh
  run-sca.sh
  run-vulnerability-regression.sh
  start-services.sh
tests/
  vulnerability/
docs/
  deepdive.md
  security-comparison.md
.github/
  workflows/
.semgrep/
.zap/
.dependency-check/
```

### appendix b: key commands

```bash
bash scripts/start-services.sh
bash scripts/run-sast.sh
bash scripts/run-sca.sh
bash scripts/run-dast.sh
bash scripts/run-vulnerability-regression.sh
```

### appendix c: sample payloads

```text
<script>alert("xss")</script>
<img src=x onerror=alert(1)>
' or '1'='1
' or 1=1 --
```

### appendix d: ci gates

| gate | condition |
|---|---|
| semgrep | fail on configured high-risk source findings |
| codeql | fail on security analysis findings |
| npm audit | fail on high or critical package advisories |
| dependency-check | fail on cvss score `7` or higher |
| zap baseline | fail on high-risk runtime alerts |
| regression tests | fail on any reintroduced known vulnerability |

## report formatting checklist

- all headings are in lowercase.
- no emoji characters are used.
- tables are included for endpoints, tools, findings, and results.
- architecture is included as a mermaid diagram.
- ethical-use statement is included.
- references are included.
- appendices include commands and payload examples.
