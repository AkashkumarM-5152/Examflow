<div align="center">

# 🌿 ExamFlow
### Intelligent University Exam Seating & Invigilation Engine

**Plan smarter. Prevent clashes. Replan in seconds.**

[![React](https://img.shields.io/badge/React-18.3.1-149ECA?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0.7-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev/)
[![Vitest](https://img.shields.io/badge/Tests-Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Privacy](https://img.shields.io/badge/Privacy-Local--First-247A60?style=for-the-badge&logo=shield&logoColor=white)](#-privacy-by-design)

**BST Internal Hackathon** · **Team 2392608111-Hackathon Babu**

> 🟢 **The challenge:** “Exam seating with no clashes, replanned in seconds.”
>
> ExamFlow turns spreadsheet-heavy exam coordination into a fast, transparent workflow for seating candidates, assigning invigilators, validating constraints, and handling last-minute disruptions.

</div>

---

## ✨ At a Glance

| 🧩 Capability | 💡 What it does |
|---|---|
| 🪑 **Smart seating** | Generates seat assignments while considering capacity, room availability, and same-subject adjacency. |
| 🛡️ **Independent validation** | Checks hard constraints and clearly identifies conflicts or infeasible plans. |
| ⚡ **Rapid replanning** | Reworks affected assignments after a room or invigilator becomes unavailable. |
| 🔍 **Explainable decisions** | Gives plain-English reasons for important planning choices and trade-offs. |
| 🖨️ **Exam-day outputs** | Creates printable notice boards, door slips, and attendance registers. |
| 🔐 **Local-first privacy** | Keeps roster data in the browser; no cloud backend is required. |

## 🧭 Contents

- [🎯 Problem Statement](#exact-problem-statement)
- [👥 Team](#team)
- [🧠 What We Built & Why](#what-we-built--why)
- [⚙️ Assumptions & Design System](#problem-interpretation-and-assumptions)
- [🏗️ Architecture & Tech Stack](#architecture--technology-stack)
- [🛡️ Algorithm & Constraints](#algorithm--constraints-suite)
- [🚀 Installation & Commands](#installation--commands)
- [🧪 Demo Scenarios](#reproducing-demo--failure-scenarios)
- [📄 CSV Import / Export](#csv-import--export-specifications)
- [✅ Regression Tests](#formal-regression-test-suite-vitest)
- [⚖️ Trade-offs](#technical-decisions-and-trade-offs)
- [🚧 Honest Limitations](#honest-unfinished-features--limitations)
- [🌐 Deployment](#deployment)

---

## 💡 What We Built & Why

We built **ExamFlow** to replace fragile spreadsheet-based exam planning with a fast, explainable workflow for seating students and assigning invigilators.

- 🪑 **Generate a seating plan:** assign candidates to usable seats while checking room capacity and scheduling conflicts.
- 🛡️ **Validate the plan:** surface hard-rule violations and explain soft-rule trade-offs instead of silently hiding them.
- ⚡ **Replan after disruptions:** respond to a room or invigilator becoming unavailable while preserving unaffected assignments where possible.
- 🗂️ **Manage operational data:** maintain students, subjects, sessions, rooms, and invigilators; import and export supported CSV data.
- 🖨️ **Prepare exam-day outputs:** produce printable notice boards, door slips, and attendance registers.
- 🔐 **Keep records local:** store roster data in the browser rather than sending candidate details to a cloud backend.

**Why it matters:** exam coordinators need to catch conflicts before exam day, understand why a plan has limitations, and recover quickly when room or staff availability changes.

---

## 🎯 Exact Problem Statement

> *"Exam seating with no clashes, replanned in seconds*
> 
> *A coordinator spends two days building seating plans and invigilator rosters in spreadsheets, and the clashes — same-subject students side by side, a teacher rostered in two halls, an overfull room — only surface on exam morning. Build a planner that takes students, subjects, rooms and staff availability, produces a plan that obeys the rules, says plainly which rule it had to bend and why, and replans in seconds when a room or an invigilator drops out."*

---

## 👥 Team

| Role | Member | USN |
|---|---|---|
| 👑 **Team Leader** | **Mohd Faiz Azher** | `2392608111` |
| Member | Devansh Bansal | `2392608011` |
| Member | Arpit Nitin Kolte | `2392608018` |
| Member | Akash Kumar M | `2392608098` |
| Member | Harshit Kumar | `2392608139` |
| Member | Viraj Bashishtha | `2392608051` |

**Team ID:** `2392608111-Hackathon Babu`

> ⚠️ **Eligibility note:** The event instructions specify a team size of 4–5, while six members are listed above. The organizers must confirm eligibility before submission. No member has been silently removed.

---

## 🔐 Privacy by Design

ExamFlow is designed to run locally in the browser. According to the project assumptions, student names, USNs, and academic records remain in browser `localStorage`; the application does not require a cloud backend, analytics service, or external API calls. This improves local control of data, but it also means records are tied to the current browser profile.

---

## ⚙️ Problem Interpretation and Assumptions

1. **Planning Slots:** The engine groups all exam sessions that overlap in date and time window into a single operational planning slot.
2. **Deterministic Clash Resolution:** When a candidate is registered for multiple exams in overlapping sessions within the same slot, the engine deterministically seats them in the primary session (lowest session ID tie-breaker) and explicitly classifies every conflicting registration as `EXAM_CLASH`.
3. **Orthogonal-Only Adjacency:** A seat is adjacent only to immediate edge neighbours (up, down, left, right). Diagonals do **not** count.
4. **Usable Capacity:** A room's usable capacity is defined as `Math.min(rows * columns, capacityOverride ?? rows * columns)`. No candidate is seated at or beyond blocked desks.
5. **Zero-Cloud Local Privacy:** Student USNs, names, and academic records remain 100% inside browser `localStorage`. No cloud backend, analytics, or external API calls are made.

---

## 🎨 Design System: Forest Green & Warm Ivory

ExamFlow uses a distinguished, academic operations design system:

- **Primary Forest Green:** `#173F35` (primary actions, navigation, authoritative headers)
- **Deep Forest Green:** `#102E28` (sidebar canvas, dark badges)
- **Emerald Accent:** `#247A60` (active selections, interactive accents)
- **Soft Mint:** `#E1F1E9` (pill backgrounds, subtle focus rings)
- **Warm Ivory Background:** `#F7F6F0` (main operational page canvas)
- **Pure White Cards:** `#FFFFFF` (elevated panels and tables)
- **Main Typography:** `#202C29`
- **Secondary Typography:** `#68766F`
- **Subtle Borders:** `#E2E7E0`
- **Muted Gold:** `#B68B45` (highlights, revision chips, warnings)
- **Critical Alert:** `#B93838` (hard violations, infeasibility)
- **Warning Amber:** `#A96B17` (soft warnings, isolated clashes)
- **Verified Green:** `#247A50` (passed validation constraints)

*Accessibility Note:* Every operational status combines color, text, and icons (`ShieldCheck`, `AlertTriangle`, `XCircle`). Status is never communicated through color alone.

---

## 🏗️ Architecture & Technology Stack

```text
React 18.3.1 + Vite 6.0.7 UI (src/ui)
  ├─ App.tsx · Application shell, 5-group sidebar, persistent DEMO badge, local persistence
  ├─ pages/
  │    ├─ DashboardPage.tsx · Derived KPIs, demand vs capacity bars, room occupancy, timeline
  │    ├─ PlannerPage.tsx · Interactive room grid, search, seat inspector, swap mode, explainability
  │    ├─ DisruptionStudioPage.tsx · 6-step guided disruption workspace with before/after diff
  │    ├─ ValidationPage.tsx · Independent constraint suite (H1–H8 & S1–S4), offending pair drilldown
  │    ├─ StudentsPage.tsx · Full CRUD, search, filter, unregistered candidate audit
  │    ├─ SubjectsSessionsPage.tsx · Full CRUD for subjects and sessions, planning slot grouping
  │    ├─ RoomsPage.tsx · Full CRUD, interactive desk grid preview, capacity overrides
  │    ├─ InvigilatorsPage.tsx · Full CRUD, building eligibility, duty status
  │    ├─ PrintExportPage.tsx · Master Notice Board, Door Slips, Attendance Registers, sanitized CSV
  │    └─ BenchmarkSettingsPage.tsx · Live in-browser 100–1,000 student stress benchmark studio
  └─ Pure TypeScript Engine (src/engine)
       ├─ types.ts · Typed domain entities, checks, movements, explanations, diffs
       ├─ demo.ts · Fictional 64-student deterministic seed dataset
       ├─ engine.ts · Seating solver, minimal-displacement replanner, independent validator, CSV engine
       └─ engine.test.ts · 13 comprehensive regression and stress tests (Vitest)
```

**Versions:** React 18.3.1, TypeScript 5.7.2, Vite 6.0.7, Vitest 2.1.8, lucide-react 0.468.0. Pinned in `package.json`.

---

## 🛡️ Algorithm & Constraints Suite

<details>
<summary><strong>How to read the constraint labels</strong></summary>

- <span style="color:#247A50"><strong>Hard constraints (H1–H8)</strong></span> are safety and correctness rules the plan must satisfy.
- <span style="color:#A96B17"><strong>Soft constraints (S1–S4)</strong></span> are goals the engine tries to optimize and explain.

</details>

### 1. Hard Constraints (H1–H8) — Must Never Be Violated
- **H1 · One Student per Seat:** Every seated candidate has distinct physical coordinates `(roomId, row, column)`. Zero collision detected.
- **H2 · Usable Capacity:** Assignments never exceed `usable(room)`. Blocked and out-of-bounds desks are excluded.
- **H3 · Room Availability:** Withdrawn rooms or rooms with matching `unavailableSessionIds` are strictly excluded.
- **H4 · No Double-Seated Students:** A candidate can have at most one exam assignment per planning slot.
- **H5 · Invigilator Eligibility:** Supervisors must be active, free during the session, and eligible for the hall's building.
- **H6 · No Double-Booked Staff:** One invigilator supervises at most one exam hall per slot.
- **H7 · Every Registration Accounted For:** Every candidate registration is either assigned a desk or carries an explicit, documented classification (`EXAM_CLASH`, `NO_CAPACITY`, or `NO_ROOM`).
- **H8 · Hall Supervisory Coverage:** Every room occupied by students is staffed by eligible faculty or explicitly classified as uncovered.

### 2. Soft Constraints (S1–S4) — Optimised with Explainability
- **S1 · Same-Subject Edge Adjacency:** Minimizes students taking the same exam sitting side-by-side or front-to-back. Diagonals do not count.
  - *Algorithmic Decision Trail:* When single-subject enrolment exceeds 50% in a room, the engine plainly explains why adjacency is mathematically required via the **Pigeonhole Principle**.
- **S2 · Room Occupancy Balance:** Balances density across open halls to avoid overfilling one hall while another sits near-empty.
- **S3 · Efficient Room Selection:** Selects halls in descending usable capacity order to minimize room sprawl, heating, and supervisory overhead.
- **S4 · Staff Load Distribution:** Balances invigilation duties across eligible rostered faculty members.

### 3. Strict Minimal-Displacement Replanning
When a room is withdrawn or capacity is reduced:
1. **Freezes Unaffected Assignments:** Candidates in unaffected rooms remain frozen in their exact rooms, rows, and columns.
2. **Relocates Only Displaced Students:** Moves only affected candidates into available seats using greedy adjacency scoring.
3. **Transparent Audit Log:** Computes a `PlanDiff` detailing moved, unchanged, and newly unassigned counts with before/after coordinates.
4. **Honest Infeasibility:** If total capacity drops below demand, displaced candidates are reported with `NO_CAPACITY`, and the plan validation status is set to `INFEASIBLE`, **never** claiming a partial plan is valid.

---

## 🚀 Installation & Commands

> 🧑‍💻 **Prerequisite:** Node.js and npm should be installed. Run these commands from the project root.

```bash
# 1. Install dependencies
npm install

# 2. Start local development server (Vite)
npm run dev

# 3. Run formal regression test suite (Vitest)
npm test

# 4. Run TypeScript typecheck
npm run typecheck

# 5. Build optimized production bundle
npm run build

# 6. Preview production build
npm run preview
```

---

## 🧪 Reproducing Demo & Failure Scenarios

> 🧪 **Suggested judging flow:** Start with the standard plan, demonstrate a room withdrawal, then show the exact capacity-shortfall scenario and the validation result.

### Scenario A: Standard Plan Generation & Explainability
1. Click **Load Demo Data** to reset to the fictional baseline: 64 students, 4 subjects, 4 sessions, 4 rooms, 5 staff.
2. Open **Planner**, select **Slot 1 (2026-11-02 10:00–13:00)**, and click **Generate Plan**.
3. *Expected Result:* 60 candidates seated across active rooms with checkerboard interleaving. The two deliberate clashing registrations (`REG-CLASH-P` and `REG-CLASH-M`) are isolated with `EXAM_CLASH`. Generation time is measured and reported (typically under 25ms).
4. Scroll to **Rule Explainability & Algorithmic Trail** to inspect the Plain-English justifications for room selection and Rule S1.

### Scenario B: Feasible Room Withdrawal (Minimal Change)
1. In **Disruption Studio** or **Planner**, choose **Withdraw Room** and select **A-101 (R1)** (capacity 30).
2. Click **Replan**.
3. *Expected Result:* Remaining usable capacity across A-102 (24), B-201 (25), and B-202 (20) is **69 seats**. Since demand (60) <= 69, the plan remains feasible. All unaffected students in B-201 and B-202 remain frozen, while students from A-101 are relocated.

### Scenario C: Exact Failure Scenario (60 Demand, 45 Capacity, 15 Shortfall)
1. With A-101 already withdrawn, withdraw **A-102 (R2)** (capacity 24).
2. Click **Replan**.
3. *Expected Result:*
   - Remaining usable capacity is **45 seats** (B-201: 25 + B-202: 20 = 45).
   - Demand is **60 candidates**.
   - Exactly **45 students** are seated.
   - Exactly **15 students** are reported unassigned with reason `NO_CAPACITY`.
   - Plan validation status is **INFEASIBLE**, clearly flagged in red with actionable guidance. It **never** claims the incomplete plan is valid.
4. Click **Restore Room A-101** and Replan. All 60 students are successfully seated again.

### Scenario D: Invigilator Withdrawal & Staff Shortfall
1. Select **Make Invigilator Unavailable** and choose **Rohan Verma (INV02)**.
2. Click **Replan**.
3. *Expected Result:* Rohan Verma is replaced by the next eligible, available faculty member from the roster without disturbing other hall supervisors.
4. If all staff are made unavailable, the planner explicitly lists every uncovered room with supervisory deficit details.

---

## 📄 CSV Import / Export Specifications

### 1. Robust CSV Parser
- Supports UTF-8 Byte Order Marks (`\uFEFF`).
- Handles Windows CRLF (`\r\n`) and Unix LF (`\n`).
- Handles quoted commas and escaped quotes (`"Doe, Jane"`).

### 2. Row-Level Data Safety
The import preview dialog validates every row before committing:
- Flags missing USN or candidate name.
- Flags duplicate USNs within the file.
- Flags duplicate USNs against existing students.
- Validates optional subject codes against active subjects and maps students to matching sessions.
- Rejects malformed rows with line-number errors.

### 3. Formula Injection Protection (`csvSafe`)
All CSV exports sanitize fields starting with `= `, `+ `, `- `, or `@ ` by prepending an apostrophe (`'`), preventing formula execution when opened in Excel, LibreOffice, or Google Sheets.

---

## ✅ Formal Regression Test Suite (Vitest)

The engine includes 13 regression tests in `src/engine/engine.test.ts` verifying all requirements:

| # | Test Scenario | Verified Outcome |
|---|---|---|
| 1 | Deterministic plan generation | Identical inputs produce 100% identical outputs and status |
| 2 | Unique seats and usable capacity | Positive coordinates, bounds inside `usable(room)`, active halls only |
| 3 | Exam-clash detection | Concurrent registrations isolated deterministically with `EXAM_CLASH` |
| 4 | Exact orthogonal adjacency | Edge neighbours detected; diagonals confirmed non-conflict |
| 5 | Unavailable room and staff | Withdrawn rooms and unavailable invigilators never assigned |
| 6 | Independent validation of corrupted plans | Independently catches duplicate seats, overcapacity, double-booking |
| 7 | Minimal-change replanning | Unaffected seats remain frozen; replaces only affected staff |
| 8 | Exact 60-demand / 45-cap / 15-shortfall | A-101 + A-102 withdrawn yields exactly 15 shortfall; status `INFEASIBLE` |
| 9 | CSV parsing, validation and safe export | BOM, CRLF, quoted commas, formula escaping, row-level validation |
| 10 | Persistence recovery and revisions | Safely handles corrupted JSON and switches revision IDs |
| 11 | Plain-English explainability logs | Rationale generated for Pigeonhole principle and room choice |
| 12 | Coordinator manual seat swap | Immediately revalidates integrity upon coordinate swap |
| 13 | High-scale stress benchmarking | Computes 200+ student plan in milliseconds |

All 13 tests run via `npm test` and pass cleanly.

---

## ⚖️ Technical Decisions and Trade-offs

- **Local-First Browser Persistence:** Student records and examination rosters are kept entirely in local storage. No network transmission or cloud exposure of candidate USNs occurs. Trade-off: Data is confined to the active browser profile.
- **Deterministic Heuristic with Local Search:** Uses checkerboard parity interleaving followed by greedy pairwise swaps capped at 500 checks. Achieves sub-25ms response time and immediate feedback for coordinators. Trade-off: Heuristic is not mathematically guaranteed optimal compared to an offline ILP solver.
- **Native Browser Print Engine:** High-contrast `@media print` stylesheets format Master Notice Boards, Door Slips, and Attendance Sheets directly for standard A4 printing without external PDF rendering bloat.

---

## 🚧 Honest Unfinished Features & Limitations

The following are important limitations to understand when evaluating or using this hackathon build:

- **No cross-device or cloud sync:** data is stored in the current browser profile. It does not automatically sync between coordinators or devices.
- **No automatic cloud backup:** clearing browser storage or losing the browser profile may remove saved data. Export important data where supported and keep a separate backup.
- **Heuristic, not guaranteed optimal:** the seating engine uses deterministic heuristics and bounded local search. It aims to reduce same-subject edge adjacency, but it does not guarantee a mathematically optimal arrangement.
- **Some constraints can make a complete plan impossible:** if available seats or eligible invigilators are insufficient, the application reports unassigned candidates or uncovered rooms rather than inventing capacity or claiming the plan is valid.
- **Adjacency definition is limited:** only immediate up/down/left/right neighbours count; diagonal neighbours are not treated as adjacent.
- **Real-world integration is not included:** the documented architecture has no cloud backend or external API integration. Data must be entered or imported into the app.
- **Production readiness still needs real-world validation:** the included regression tests cover the documented scenarios, but they do not replace testing with each institution's actual policies, datasets, browsers, and exam workflows.

These are limitations, not claims that the features are secretly available. The documented commands and demo scenarios are the intended way to run and evaluate the current build.

---

## 🌐 Deployment

<details>
<summary><strong>Production build and hosting notes</strong></summary>

The application is designed to build into a static `dist/` bundle. No backend server, Docker container, or environment variables are required for the documented deployment flow.

</details>

Run `npm run build` to generate the production bundle in `dist/`. Deploy the `dist/` folder to any static hosting provider (Vercel, Netlify, Cloudflare Pages, GitHub Pages). No backend server, Docker container, or environment variables are required.


---

<div align="center">

### 🌿 ExamFlow · Built for clearer, calmer exam operations

**Team 2392608111-Hackathon Babu** · BST Internal Hackathon

<sub>Designed around transparency, operational reliability, and local-first data handling.</sub>

</div>
