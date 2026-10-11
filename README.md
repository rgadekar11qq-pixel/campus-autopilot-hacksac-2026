# CAMPUS AUTOPILOT — HackSAC 2026 (Team STRATOS)

> **"Campus Autopilot doesn't just show you campus availability. It helps you find a feasible plan and recover when that plan breaks."**

Campus Autopilot is a campus operations and deterministic resource orchestration system built by **Team STRATOS** for **METSAC HackSAC 2026** (*Primary Problem Statement: Making Campus Gatherings Work; Secondary Problem Statement: Circulating Knowledge on Campus*).

---

## 1. Architecture & Two-Layer Product Design

All domain logic, interval mathematics, turnaround buffer policies, and constraint-solving algorithms live in pure, strongly typed TypeScript modules (`src/domain/`) completely separated from React UI components (`src/components/`).

1. **Campus Operations Interface (`src/components/`):**
   - **Campus Command Center (`CommandCenterView.tsx`):** Answers *"What is happening, what is available, and what needs attention?"* with live derived metrics, schedule cards, space matrix, and operational audit feed. Every metric card navigates to its corresponding operational view.
   - **Campus Timeline (`TimelineView.tsx`):** Interactive Day and Week multi-room timeline displaying setup windows, core event intervals, cleanup intervals, mandatory 15-minute / 30-minute turnaround buffers, and room unavailability locks. Clicking any free hour slot opens Smart Booking pre-filled for that room and time.
   - **Smart Booking (`SmartBookingView.tsx`):** Real-time multi-constraint validation returning one of three explicit states: `1. FEASIBLE`, `2. ALTERNATIVES AVAILABLE` (with one-click valid alternatives), or `3. NO FEASIBLE PLAN` (with exact blocking constraint diagnostics).
   - **Resource Inventory (`InventoryView.tsx`):** Searchable catalog for robotics, AV, compute, and fabrication equipment with derived interval availability, checkout/return tracking, damaged/missing unit reporting, and documented procurement cost avoidance via reuse.
   - **Impact & Utilization (`ImpactView.tsx`):** Analytics computed directly from application state records, explicitly separating recorded state measurements from documented replacement-cost estimates.
   - **Activity & Audit Log (`AuditLogView.tsx`):** Immutable session log with explicit `SIMULATED` badges, timestamps, affected entities, and constraint rationale.
   - **Contextual Side Inspector (`InspectorDrawer.tsx`):** Inspect any room or event without modal clutter.

2. **Campus Shockwave Engine (`src/domain/engine.ts` & `src/domain/shockwave.ts`):**
   - Enforces 11 hard constraints across half-open `[start, end)` intervals: room unavailability locks, core booking overlap, protected setup/cleanup intervals, mandatory 15m/30m turnaround gaps, room seating capacity, required facilities, equipment operational pool quantities, mentor commitment overlaps, and mentor unavailability windows.
   - Clones application state for non-destructive simulation (`applyDisruptionToState`), traces direct and indirect event dependencies (`inspectEventDependencies`), performs a bounded deterministic search across campus rooms, time slots, and mentor substitutions (`simulateShockwave`), explains why invalid candidates were rejected, ranks valid candidates using a transparent 100-point scoring function, and commits approved plans atomically with optimistic concurrency (`stateVersion`) checks (`approveCandidatePlan`).

---

## 2. Technology Stack

- **Framework:** Next.js 15 (App Router) + React 19
- **Language:** TypeScript 5 (Strict mode)
- **Styling:** Tailwind CSS 3.4 with custom dark operational command-center tokens (`src/app/globals.css`)
- **Icons:** `lucide-react`
- **Testing:** Vitest (`src/domain/__tests__/engine.test.ts` — 17 verification tests)
- **Persistence:** Versioned `localStorage` persistence (`campus_autopilot_state_v2`) with safe hydration fallback, isolated demo scenario reset, and full factory reset. Runs 100% locally without external APIs or paid credentials.

---

## 3. Setup, Commands & Verification

```bash
# 1. Install dependencies
npm install

# 2. Run the 17-test verification suite (scheduling, buffers, equipment, Shockwave)
npm test

# 3. Run TypeScript type-checking
npm run lint

# 4. Build production bundle
npm run build

# 5. Start local development server (http://localhost:3000)
npm run dev
```

---

## 4. Exact Steps to Run the Campus Shockwave Live Demo

You can run either the **Instant 1-Click Shockwave Demo** or the **Full 10-Step Guided Creation + Disruption Workflow**:

### Path A: Instant 1-Click Live Demo
1. Open the app at `http://localhost:3000`.
2. In the **Campus Command Center** hero banner (or top header), click **"Trigger Shockwave: Room Unavailable"**.
3. The system automatically navigates to **Campus Shockwave**, locks **Turing Innovation Hall (INV-101)** from `10:30–14:00` on a simulation copy, and evaluates the **Autonomous Robotics Systems Workshop** (80 attendees, 8× ROS2 kits, 1× 4K projector, 2 mentors, 90m + 15m turnaround).
4. Inspect **Why Other Candidates Were Rejected** on the right (e.g., *Ada Lovelace Robotics Lab* rejected because capacity is 60 < 80; *Charles Babbage Seminar Hall* rejected due to missing `WORKBENCHES` & `POWER_GRID_HIGH` plus an overlapping lecture).
5. Compare the **Ranked Feasible Recovery Plans** on the left:
   - **Rank #1:** Relocate to **Grace Hopper Main Auditorium (CEN-201, Cap 120)** at the **exact original time (`11:00–12:30`)** with zero displacement of other events and 100% equipment/mentor preservation.
   - **Rank #2:** Relocate to **Nikola Tesla Mechatronics Arena (ENG-104, Cap 85)** at the **exact original time (`11:00–12:30`)** (ranked slightly below #1 due to tighter capacity margin and 30m safety turnaround policy).
6. Click **"Approve & Apply Plan #1"**.
7. View the **Before-vs-After Atomic Approval Banner**, then click **"Inspect Updated Timeline"** or **"View Audit Record"** to verify that the room, equipment allocations, mentor commitments, and audit log updated atomically.
8. Click **"Reset Demo"** in the top header at any time to restore the exact baseline without erasing unrelated bookings.

### Path B: Full 10-Step End-to-End Booking + Disruption Workflow
1. On the **Campus Command Center**, click **"Step 1: Book Robotics Workshop"**.
2. In **Smart Booking**, inspect the pre-loaded requirements (80 attendees, 8× ROS2 kits, 1× 4K projector, 2 mentors, 15m setup, 15m cleanup, 15m turnaround) and verify the green `1. FEASIBLE` engine state.
3. Click **"Confirm & Allocate Feasible Plan"** to book the workshop and view it on the **Campus Timeline**.
4. Click **"Live Demo: Shockwave"** in the top bar to trigger the room outage, compare alternatives, and approve a recovery plan.

---

## 5. Known Limitations & Future Integrations

- **Simulated Dataset:** All campus buildings, rooms, equipment SKUs, and schedules represent a simulated METSAC HackSAC 2026 operational dataset and are not connected to live institutional ERP/SSO systems.
- **Bounded Deterministic Search:** Candidate generation evaluates single-event relocations, time shifts across standard operational intervals, and single-mentor substitutions deterministically rather than running an unbounded multi-day MILP solver.
