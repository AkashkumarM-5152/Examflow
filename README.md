# ExamFlow — Intelligent Exam Seating & Invigilation Planner

ExamFlow is a local-first web application for generating, validating, reviewing and replanning university exam seating and invigilation assignments.

## Exact problem statement

"Exam seating with no clashes, replanned in seconds

A coordinator spends two days building seating plans and invigilator rosters in spreadsheets, and the clashes — same-subject students side by side, a teacher rostered in two halls, an overfull room — only surface on exam morning. Build a planner that takes students, subjects, rooms and staff availability, produces a plan that obeys the rules, says plainly which rule it had to bend and why, and replans in seconds when a room or an invigilator drops out."

## Team

- **Team:** 2392608111-Hackathon Babu
- **Team leader:** Mohd Faiz Azher
- Mohd Faiz Azher — USN 2392608111
- Devansh Bansal — USN 2392608011
- Arpit Nitin Kolte — USN 2392608018
- Akash Kumar M — USN 2392608098
- Harshit Kumar — USN 2392608139
- Viraj Bashishtha — USN 2392608051

**Eligibility note:** The event instructions specify a team size of 4–5, while six members are listed above. The organizers must confirm eligibility before submission. No member has been silently removed.

## Problem interpretation and assumptions

The engine plans overlapping sessions together as one planning slot. Students with multiple registrations in that slot are assigned to the lowest session ID and their other registrations are explicitly flagged as `EXAM_CLASH`. Room capacity is rows × columns unless a lower capacity override is set. Seats are edge-adjacent only (up/down/left/right); diagonals do not count.

## Target users

Exam coordinators and invigilation staff at colleges/universities who need an explainable seating plan and a fast way to respond to unavailable rooms or staff.

## What is built

The current implementation includes a dashboard, seeded demo dataset, student directory with add/delete and CSV import preview, subject/session and planning-slot view, room and invigilator views, a deterministic seating generator, independent plan checks, room/invigilator disruption preview and acceptance, local revision history, and CSV exports. Some CRUD operations and import flows are intentionally narrower than the complete master specification; see Known limitations.

## Core user journey

1. Load Demo Data.
2. Select Slot 1 in Planner and generate a plan.
3. Review seating grids and validation checks.
4. Choose a room/staff disruption and replan.
5. Inspect the before/after diff and accept the revision.
6. Export seating, room-wise, roster or conflict CSV.

## Key features

- Deterministic, pure-TypeScript engine separate from React.
- Independent validation of seat occupancy, capacity, room status, duplicate student seating, staff eligibility, staff double-booking, registration accounting, room coverage, and same-subject adjacency.
- Local-first persistence in versioned localStorage with safe fallback on malformed or outdated state.
- CSV parser supports UTF-8 BOM, CRLF and quoted commas; formula-like export values are prefixed with an apostrophe.
- Responsive navigation and seating grids; print stylesheet for browser printing.
- Persistent demo-data label and honest incomplete/invalid statuses.

## What makes it different

The validator recomputes checks from the assignments rather than trusting generator claims. Disruptions create a preview that must be accepted to become current. The app exposes exceptions rather than silently marking incomplete plans as valid.

## Technical decisions and rejected alternatives

- **React + TypeScript + Vite:** fast static build and type checking for a compact hackathon app.
- **localStorage instead of a backend/database:** no secrets or network transmission of student records; trade-off is single-browser data only.
- **Heuristic rather than ILP/CP-SAT or simulated annealing:** avoids a solver dependency and is easier to explain within a 12-hour event. This is not guaranteed optimal.
- **Browser print rather than PDF generation:** relies on the browser print dialog instead of an additional PDF rendering stack.

## Architecture

```text
React UI (src/ui)
  ├─ Dashboard / Planner / Data pages / Validation / Exports
  ├─ localStorage persistence (schemaVersion 1)
  └─ Pure engine (src/engine)
       ├─ deterministic demo data
       ├─ slot grouping and adjacency
       ├─ generator and local improvement
       ├─ independent validator
       ├─ disruption replan
       └─ CSV parser and export escaping
```

## Folder structure

- `src/engine/types.ts` — shared domain types
- `src/engine/demo.ts` — fictional deterministic seed dataset
- `src/engine/engine.ts` — slot grouping, generator, validator, replan, CSV utilities
- `src/engine/engine.test.ts` — engine tests
- `src/ui/App.tsx` — application UI and local persistence
- `src/ui.css` — responsive design and print styles
- `index.html` — Vite entry point

## Tech stack

React 18.3.1, TypeScript 5.7.2, Vite 6.0.7, Vitest 2.1.8, lucide-react 0.468.0. Versions are pinned in `package.json` and `package-lock.json`.

## Data model

The engine defines Student, Subject, ExamSession, Registration, Room, Invigilator, SeatingAssignment, InvigilatorAssignment, UnassignedEntry, UncoveredRoom, ValidationReport, PlanRevision and AppState in `src/engine/types.ts`.

## Algorithm and constraints

1. Group overlapping sessions by date and time.
2. Resolve duplicate student registrations in a slot by lowest session ID and mark the rest `EXAM_CLASH`.
3. Choose active rooms in descending usable capacity (ID tie-break), targeting 110% headroom when possible.
4. Order subject queues by group size and subject code, interleave students round-robin, and fill checkerboard-parity seats first.
5. Attempt deterministic student swaps while they strictly reduce same-subject edge-adjacency, with a 500-swap-check cap.
6. Assign lowest-ID eligible, free invigilators to used rooms; list uncovered rooms if staffing is insufficient.
7. Independently validate the resulting assignments.

The generator is a heuristic and is not guaranteed optimal; local improvement can leave avoidable adjacency because it only considers pairwise swaps under a fixed iteration cap. Room/capacity replanning preserves unaffected assignments, then moves affected students into available seats with a greedy adjacency score. If capacity is insufficient, affected students are explicitly unassigned. Invigilator-only replanning retains unaffected room assignments and replaces the unavailable staff member when an eligible free person exists. The full-regeneration fallback threshold described in the specification is not implemented. Compute time is measured and therefore naturally varies between runs; assignments and decisions are deterministic for identical inputs.

Default staffing is one invigilator per used room; rooms above 40 students require two. These thresholds are configurable in `AppState.settings` (large-room threshold 40, large-room staffing 2).

Hard rules: one student per seat, usable capacity, room availability, no duplicate student seating in a slot, invigilator availability/eligibility, no staff double-booking, registration accounting, and used-room coverage. Soft check: same-subject edge adjacency. The current UI reports actual validation status; it does not force a green status.

## Install and run

```bash
npm install
npm run dev
```

## Tests, typecheck and production build

```bash
npm test
npm run typecheck
npm run build
npm run preview
```

The engine source was compiled independently with the system TypeScript compiler and an 11-case Node smoke suite passed; details are recorded in the final delivery note. Full Vitest, full app typecheck and production build were not run because the package registry was unreachable in this environment.

## Demo data

Load Demo Data to reset to the fictional scenario: 64 students (`DEMO0001`–`DEMO0064`), four subjects, four sessions, four rooms and five invigilators. Slot 1 includes two deliberately overlapping registrations and INV05 is unavailable for Slot 1. Students DEMO0061–0064 have no registrations.

## Reproduce room-withdrawal demo

1. Load Demo Data.
2. Open Planner, select Slot 1 (2 November 2026, 10:00–13:00), then Generate plan.
3. In Disruption & replanning, choose Withdraw room and A-101 (R1).
4. Click Replan and review moved/unchanged counts and the new validation status.
5. Accept revision only after reviewing the result.

The original demo has 60 unique students in Slot 1 and two clash entries. Room selection targets at least 66 usable seats; room choice follows descending capacity. Actual room occupancy, adjacency counts and elapsed time are calculated at runtime and can vary by environment.

## Reproduce invigilator-withdrawal demo

1. Generate Slot 1.
2. Choose Make invigilator unavailable, select Rohan Verma (INV02), and click Replan.
3. Review the replacement staff and coverage status before accepting.

## Reproduce an infeasible scenario

Withdraw rooms until total usable capacity is below demand. The planner reports unassigned students and a non-valid status. Do not use a green success state to represent an incomplete plan.

## CSV import/export formats

Student import header: `usn,name,subject_code,session_date`. `usn` and `name` are required. `subject_code` and `session_date` are optional; if supplied, subject codes are checked. This import currently adds student records only; it does not automatically create registration rows. Export files include `examflow-students.csv`, `examflow-seating.csv`, `examflow-room-wise.csv`, `examflow-invigilators.csv`, and `examflow-conflicts.csv`.

## Testing performed

The Vitest test source contains nine tests covering demo assignment counts, room capacity/status, adjacency definition, insufficient capacity, staff shortfall, CSV parsing and escaping, deterministic assignments, room withdrawal, and duplicate-seat validation. Full Vitest execution was blocked because npm could not resolve `registry.npmjs.org` (EAI_AGAIN). A separate engine-only compile succeeded; the smoke-run must be rerun after dependency installation.

## Known limitations

- Replanning room/capacity disruptions currently uses full regeneration and may move unaffected students.
- Student CSV import adds student records but does not create registrations from the optional subject/date columns.
- Students and sessions have limited CRUD; subjects, sessions, rooms and invigilators are not fully editable through forms yet.
- The validator and UI provide a practical first pass but should be extended with detailed offending seat-pair drilldowns, a comprehensive tamper suite, and stricter referential-integrity checks.
- Data is stored only in the current browser; no authentication, multi-user sync or backend exists.
- Heuristic plans are not guaranteed optimal.

## Unfinished work

Full CRUD for every entity, strict minimal-change room replanning, comprehensive import row preview, side-by-side assignment-level diff, exact capacity-shortfall proof in all edge cases, complete large synthetic scenario test, and richer print layouts remain unfinished.

## Deployment

Run `npm run build`; deploy the `dist/` folder to Netlify, Vercel or a static host. Vite uses hash-independent page state in this build, so no client-side route rewrite is required. No deployment has been performed as part of this build.

## Screenshots

No screenshots captured yet. Add real screenshots after running the app locally; do not represent placeholders as evidence of a working build.
