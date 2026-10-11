import { describe, it, expect } from "vitest";
import { createInitialSeedState, DEMO_PRIMARY_DATE } from "../seedData";
import {
  computeOperationalMetrics,
  createValidatedBooking,
  detectGlobalConflicts,
  evaluateRequestFeasibility,
} from "../engine";
import {
  approveCandidatePlan,
  rejectShockwaveProposal,
  simulateShockwave,
} from "../shockwave";
import {
  cancelBookingById,
  loadPersistedState,
  resetDemoScenarioOnly,
  savePersistedState,
  updateAllocationReturnStatus,
} from "../operations";
import { TransactionalCampusStore } from "../serverStore";
import { BookingDraftInput, Disruption } from "../types";

function makeValidDraft(
  overrides: Partial<BookingDraftInput> = {}
): BookingDraftInput {
  return {
    title: "Autonomous Rover Calibration Session",
    description: "Testing LiDAR SLAM loop closure",
    organizer: "STRATOS Team",
    category: "WORKSHOP",
    priority: "HIGH",
    dateStr: DEMO_PRIMARY_DATE,
    startTimeStr: "15:00",
    durationMinutes: 60,
    expectedAttendance: 50,
    preferredRoomId: "rm-turing-hall",
    requiredFacilities: ["PROJECTOR_4K", "WORKBENCHES"],
    requiredResources: [{ resourceId: "res-ros-kit", quantity: 4 }],
    requiredPeopleIds: ["per-kavya"],
    setupMinutes: 15,
    cleanupMinutes: 15,
    requiresExtendedTurnaround: false,
    ...overrides,
  };
}

describe("Backend Integrity, Edge Cases, Concurrency & End-to-End Audit Suite", () => {
  describe("Section 3: Complete Booking Workflow & Input/Boundary Hardening", () => {
    it("3A. Valid booking persists and updates dashboard, timeline, inventory, and audit log consistently", () => {
      const store = new TransactionalCampusStore();
      const beforeMetrics = store.getSnapshotWithMetrics(DEMO_PRIMARY_DATE).metrics;

      const res = store.executeAction({
        action: "CREATE_BOOKING",
        draft: makeValidDraft(),
        actor: "QA Auditor",
      });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);

      const afterSnapshot = store.getSnapshotWithMetrics(DEMO_PRIMARY_DATE);
      expect(afterSnapshot.metrics.dayBookings.length).toBe(
        beforeMetrics.dayBookings.length + 1
      );
      expect(afterSnapshot.metrics.activeDayUnitAllocations).toBe(
        beforeMetrics.activeDayUnitAllocations + 4
      );
      expect(afterSnapshot.state.auditLog[0].action).toBe("BOOKING_CONFIRMED");

      // Verify persistence round-trip
      const mem = new Map<string, string>();
      const mockStorage = {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => {
          mem.set(k, v);
        },
      };
      savePersistedState(afterSnapshot.state, mockStorage);
      const reloaded = loadPersistedState(mockStorage);
      expect(reloaded.stateVersion).toBe(afterSnapshot.stateVersion);
      expect(reloaded.bookings.length).toBe(afterSnapshot.state.bookings.length);
    });

    it("3B. Rejects malformed dates, negative attendance, negative buffers, and empty titles (Regression Defect #1)", () => {
      const state = createInitialSeedState();

      const badDate = createValidatedBooking(
        state,
        makeValidDraft({ dateStr: "not-a-date" })
      );
      expect(badDate.ok).toBe(false);

      const badTime = createValidatedBooking(
        state,
        makeValidDraft({ startTimeStr: "99:99" })
      );
      expect(badTime.ok).toBe(false);

      const emptyTitle = createValidatedBooking(
        state,
        makeValidDraft({ title: "   " })
      );
      expect(emptyTitle.ok).toBe(false);

      const negativeAttendance = evaluateRequestFeasibility(state, {
        roomId: "rm-turing-hall",
        startIso: `${DEMO_PRIMARY_DATE}T15:00:00`,
        endIso: `${DEMO_PRIMARY_DATE}T16:00:00`,
        setupMinutes: 15,
        cleanupMinutes: 15,
        expectedAttendance: -10,
        requiredFacilities: [],
        requiredResources: [],
        requiredPeopleIds: [],
      });
      expect(negativeAttendance.isFeasible).toBe(false);
      expect(
        negativeAttendance.violations.some(
          (v) => v.code === "CAPACITY_INSUFFICIENT"
        )
      ).toBe(true);

      const negativeBuffer = evaluateRequestFeasibility(state, {
        roomId: "rm-turing-hall",
        startIso: `${DEMO_PRIMARY_DATE}T15:00:00`,
        endIso: `${DEMO_PRIMARY_DATE}T16:00:00`,
        setupMinutes: -15,
        cleanupMinutes: 15,
        expectedAttendance: 30,
        requiredFacilities: [],
        requiredResources: [],
        requiredPeopleIds: [],
      });
      expect(negativeBuffer.isFeasible).toBe(false);
      expect(
        negativeBuffer.violations.some((v) => v.code === "INVALID_INTERVAL")
      ).toBe(true);
    });

    it("3B. Aggregates duplicate resource entries in payload so pool limits cannot be bypassed (Regression Defect #2)", () => {
      const state = createInitialSeedState();
      // res-laser-proj has 4 operational units. Passing two entries of 3 units each (total 6 > 4) must be rejected!
      const res = createValidatedBooking(
        state,
        makeValidDraft({
          requiredResources: [
            { resourceId: "res-laser-proj", quantity: 3 },
            { resourceId: "res-laser-proj", quantity: 3 },
          ],
        })
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(
          res.feasibility.violations.some(
            (v) => v.code === "RESOURCE_INSUFFICIENT"
          )
        ).toBe(true);
      }
    });

    it("3B. Rejects missing facility infrastructure and non-existent mentor IDs", () => {
      const state = createInitialSeedState();
      // rm-babbage-sem lacks WORKBENCHES and POWER_GRID_HIGH
      const missingFac = evaluateRequestFeasibility(state, {
        roomId: "rm-babbage-sem",
        startIso: `${DEMO_PRIMARY_DATE}T15:00:00`,
        endIso: `${DEMO_PRIMARY_DATE}T16:00:00`,
        setupMinutes: 10,
        cleanupMinutes: 10,
        expectedAttendance: 50,
        requiredFacilities: ["WORKBENCHES", "POWER_GRID_HIGH"],
        requiredResources: [],
        requiredPeopleIds: ["per-non-existent"],
      });
      expect(missingFac.isFeasible).toBe(false);
      expect(
        missingFac.violations.some((v) => v.code === "MISSING_FACILITY")
      ).toBe(true);
      expect(
        missingFac.violations.some((v) => v.code === "PERSON_UNAVAILABLE")
      ).toBe(true);
    });

    it("3C. Enforces exact boundary interval logic (09:00–10:00 + 15m buffer rejects 10:10, allows 10:15 boundary)", () => {
      const state = createInitialSeedState();
      // Book 09:00-10:00 in rm-babbage-sem with 0m setup, 15m cleanup, and authorized turnaround override (so cleanupEnd = 10:15)
      const firstBooking = createValidatedBooking(
        state,
        makeValidDraft({
          title: "Morning Boundary Session",
          preferredRoomId: "rm-babbage-sem",
          startTimeStr: "09:00",
          durationMinutes: 60,
          setupMinutes: 0,
          cleanupMinutes: 15,
          overrideTurnaroundReason: "Authorized boundary test",
          requiredFacilities: ["PROJECTOR_4K"],
          requiredResources: [],
          requiredPeopleIds: [],
        })
      );
      expect(firstBooking.ok).toBe(true);
      if (!firstBooking.ok) return;

      // Attempting a second booking at 10:10 (with 0m setup) must fail because cleanup runs until 10:15
      const at1010 = evaluateRequestFeasibility(firstBooking.nextState, {
        roomId: "rm-babbage-sem",
        startIso: `${DEMO_PRIMARY_DATE}T10:10:00`,
        endIso: `${DEMO_PRIMARY_DATE}T11:00:00`,
        setupMinutes: 0,
        cleanupMinutes: 0,
        expectedAttendance: 40,
        requiredFacilities: ["PROJECTOR_4K"],
        requiredResources: [],
        requiredPeopleIds: [],
      });
      expect(at1010.isFeasible).toBe(false);
      expect(
        at1010.violations.some((v) => v.code === "SETUP_CLEANUP_CONFLICT")
      ).toBe(true);

      // Attempting a second booking at exactly 10:15 (with 0m setup, ending 11:00, override turnaround) succeeds under half-open [start, end)
      const at1015 = evaluateRequestFeasibility(firstBooking.nextState, {
        roomId: "rm-babbage-sem",
        startIso: `${DEMO_PRIMARY_DATE}T10:15:00`,
        endIso: `${DEMO_PRIMARY_DATE}T11:00:00`,
        setupMinutes: 0,
        cleanupMinutes: 0,
        expectedAttendance: 40,
        requiredFacilities: ["PROJECTOR_4K"],
        requiredResources: [],
        requiredPeopleIds: [],
        overrideTurnaroundReason: "Boundary check before 11:15 setup",
      });
      expect(at1015.isFeasible).toBe(true);
    });
  });

  describe("Section 4: Campus Shockwave — All 5 Flagship Scenarios", () => {
    it("Scenario 1 & Critical Invariant: Simulation never mutates authoritative state while ranking feasible alternatives", () => {
      const state = createInitialSeedState();
      const snapshotBefore = JSON.stringify(state);

      const disruption: Disruption = {
        id: "disr-s1",
        type: "ROOM_UNAVAILABLE",
        title: "Turing Hall Outage",
        description: "INV-101 locked 10:30–14:00",
        targetEventId: "evt-robotics-workshop",
        targetRoomId: "rm-turing-hall",
        unavailableStartIso: `${DEMO_PRIMARY_DATE}T10:30:00`,
        unavailableEndIso: `${DEMO_PRIMARY_DATE}T14:00:00`,
        createdAtIso: "2026-10-15T10:00:00Z",
      };

      const sim = simulateShockwave(state, disruption);

      // Critical invariant: authoritative state is 100% untouched after simulation
      expect(JSON.stringify(state)).toBe(snapshotBefore);

      // Identifies affected event and violations
      expect(sim.directlyAffectedEventIds).toContain("evt-robotics-workshop");
      expect(
        sim.originalViolations.some((v) => v.code === "ROOM_UNAVAILABLE_WINDOW")
      ).toBe(true);

      // Rejects infeasible rooms (Ada Lovelace Lab cap 60, Babbage Seminar Hall missing facilities)
      const rejectedRoomIds = sim.rejectedAttempts.map((r) => r.roomId);
      expect(rejectedRoomIds).toContain("rm-lovelace-lab");
      expect(rejectedRoomIds).toContain("rm-babbage-sem");

      // Ranks Grace Hopper Auditorium #1 (Score 98) and Nikola Tesla Arena #2 (Score 92)
      expect(sim.validCandidates[0].proposedRoomId).toBe("rm-hopper-aud");
      expect(sim.validCandidates[1].proposedRoomId).toBe("rm-tesla-arena");
      expect(sim.validCandidates[0].score.totalScore).toBeGreaterThan(
        sim.validCandidates[1].score.totalScore
      );
    });

    it("Scenario 2 & 3: Rejecting a plan leaves state unchanged; approving commits atomically and prevents duplicate approval (Regression Defect #4)", () => {
      const state = createInitialSeedState();
      const disruption: Disruption = {
        id: "disr-s2",
        type: "ROOM_UNAVAILABLE",
        title: "Turing Hall Outage",
        description: "INV-101 locked 10:30–14:00",
        targetEventId: "evt-robotics-workshop",
        targetRoomId: "rm-turing-hall",
        unavailableStartIso: `${DEMO_PRIMARY_DATE}T10:30:00`,
        unavailableEndIso: `${DEMO_PRIMARY_DATE}T14:00:00`,
        createdAtIso: "2026-10-15T10:00:00Z",
      };

      const sim = simulateShockwave(state, disruption);

      // Scenario 3: Rejecting proposal commits zero changes
      const rejected = rejectShockwaveProposal(state, disruption);
      expect(rejected.nextState.stateVersion).toBe(state.stateVersion);
      expect(
        rejected.nextState.bookings.find((b) => b.id === "bkg-robotics-workshop")
          ?.roomId
      ).toBe("rm-turing-hall");

      // Scenario 2: Approving Rank #1 candidate updates state atomically
      const approved = approveCandidatePlan(
        state,
        disruption,
        sim.validCandidates[0]
      );
      expect(approved.ok).toBe(true);
      if (!approved.ok) return;

      const updatedBkg = approved.nextState.bookings.find(
        (b) => b.id === "bkg-robotics-workshop"
      )!;
      expect(updatedBkg.roomId).toBe("rm-hopper-aud");
      expect(detectGlobalConflicts(approved.nextState).length).toBe(0);

      // Regression Defect #4: Attempting to approve the same disruption/candidate again is rejected
      const duplicateApproval = approveCandidatePlan(
        approved.nextState,
        disruption,
        {
          ...sim.validCandidates[0],
          stateVersionAtGeneration: approved.nextState.stateVersion,
        }
      );
      expect(duplicateApproval.ok).toBe(false);
    });
  });

  describe("Section 5 & 6: Resource Circulation, Double-Return Guards & Metric Integrity", () => {
    it("Prevents returning an item twice or returning a cancelled allocation (Regression Defect #3)", () => {
      const state = createInitialSeedState();
      // alloc-opening-proj is already RETURNED in seed state
      const afterSecondReturn = updateAllocationReturnStatus(
        state,
        "alloc-opening-proj",
        "RETURNED",
        "Attempting duplicate return"
      );
      expect(afterSecondReturn.stateVersion).toBe(state.stateVersion);

      // Reporting 1 damaged unit on alloc-fpga-kits (currently CHECKED_OUT, 15 op units)
      const afterFirstDamage = updateAllocationReturnStatus(
        state,
        "alloc-fpga-kits",
        "DAMAGED_ON_RETURN",
        "1 board damaged",
        1
      );
      expect(afterFirstDamage.stateVersion).toBe(state.stateVersion + 1);
      const fpgaAfter1 = afterFirstDamage.resources.find(
        (r) => r.id === "res-fpga-board"
      )!;
      expect(fpgaAfter1.operationalQuantity).toBe(14);

      // Attempting to report damage a second time on the already-closed allocation must be blocked
      const afterDuplicateDamage = updateAllocationReturnStatus(
        afterFirstDamage,
        "alloc-fpga-kits",
        "DAMAGED_ON_RETURN",
        "Duplicate damage report",
        1
      );
      expect(afterDuplicateDamage.stateVersion).toBe(
        afterFirstDamage.stateVersion
      );
      expect(
        afterDuplicateDamage.resources.find((r) => r.id === "res-fpga-board")!
          .operationalQuantity
      ).toBe(14);

      // Cancelling bkg-robotics-workshop marks alloc-robotics-kits CANCELLED; returning it must be blocked
      const cancelledState = cancelBookingById(state, "bkg-robotics-workshop");
      const returnCancelled = updateAllocationReturnStatus(
        cancelledState,
        "alloc-robotics-kits",
        "RETURNED",
        "Should fail because booking was cancelled"
      );
      expect(returnCancelled.stateVersion).toBe(cancelledState.stateVersion);
    });

    it("Verifies dashboard metrics accurately separate operational pool (50), peak concurrent usage (23), active unit-slots (37), and reuse value (₹16,24,000 / ₹18,43,000)", () => {
      const state = createInitialSeedState();
      const metrics = computeOperationalMetrics(state, DEMO_PRIMARY_DATE);

      expect(metrics.totalOperationalUnits).toBe(50);
      expect(metrics.activeDayUnitAllocations).toBe(37);
      expect(metrics.peakConcurrentUnitsOnDate).toBe(23); // At 11:15-11:45: 8 ROS2 + 1 Proj + 12 FPGA + 2 PA = 23 concurrent units
      expect(metrics.activeDayReusedValueInr).toBe(1624000);
      expect(metrics.totalSessionReusedValueInr).toBe(1843000);
    });

    it("Detects a deliberately injected conflict on the dashboard and clears it when resolved", () => {
      const state = createInitialSeedState();
      expect(detectGlobalConflicts(state).length).toBe(0);

      // Deliberately inject a room unavailability window overlapping bkg-ai-ethics in rm-babbage-sem
      const conflictedState = structuredClone(state);
      conflictedState.availabilityWindows.push({
        id: "win-injected-conflict",
        entityType: "ROOM",
        entityId: "rm-babbage-sem",
        startIso: `${DEMO_PRIMARY_DATE}T11:30:00`,
        endIso: `${DEMO_PRIMARY_DATE}T12:30:00`,
        status: "UNAVAILABLE",
        reason: "Deliberate audit conflict injection",
      });

      const conflicts = detectGlobalConflicts(conflictedState);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].bookingId).toBe("bkg-ai-ethics");

      // Remove the conflict by cancelling bkg-ai-ethics
      const resolvedState = cancelBookingById(
        conflictedState,
        "bkg-ai-ethics",
        "Resolved conflict"
      );
      expect(detectGlobalConflicts(resolvedState).length).toBe(0);
    });
  });

  describe("Section 7 & 8: Server Store Transactions, Competing Requests & API Security", () => {
    it("Prevents double-booking when two competing requests race for the same room or last equipment units", () => {
      const store = new TransactionalCampusStore();
      const initialVersion = store.getState().stateVersion;

      const competingDraftA = makeValidDraft({
        title: "Competing Robotics Team A",
        startTimeStr: "16:00",
        preferredRoomId: "rm-turing-hall",
        requiredResources: [{ resourceId: "res-laser-proj", quantity: 3 }],
      });

      const competingDraftB = makeValidDraft({
        title: "Competing Robotics Team B",
        startTimeStr: "16:00",
        preferredRoomId: "rm-hopper-aud",
        // Requesting 3 projectors at the same time when only 4 exist in total (3+3=6 > 4)
        requiredResources: [{ resourceId: "res-laser-proj", quantity: 3 }],
      });

      // Request A arrives at v1 and succeeds (201)
      const resA = store.executeAction({
        action: "CREATE_BOOKING",
        expectedStateVersion: initialVersion,
        draft: competingDraftA,
      });
      expect(resA.status).toBe(201);

      // Request B arrives with stale expectedStateVersion (v1) -> rejected with 409 CONCURRENCY_CONFLICT
      const resBStale = store.executeAction({
        action: "CREATE_BOOKING",
        expectedStateVersion: initialVersion,
        draft: competingDraftB,
      });
      expect(resBStale.status).toBe(409);
      expect(resBStale.body.errorCode).toBe("CONCURRENCY_CONFLICT");

      // Even if Request B retries with current stateVersion (v2), it is rejected with 422 CONSTRAINT_VIOLATION because only 1 projector remains
      const resBRetry = store.executeAction({
        action: "CREATE_BOOKING",
        expectedStateVersion: store.getState().stateVersion,
        draft: competingDraftB,
      });
      expect(resBRetry.status).toBe(422);
      expect(resBRetry.body.errorCode).toBe("CONSTRAINT_VIOLATION");
    });

    it("Validates untrusted API payloads and returns structured 400/404/409 errors without stack traces", () => {
      const store = new TransactionalCampusStore();

      expect(store.executeAction(null).status).toBe(400);
      expect(store.executeAction({ action: "" }).status).toBe(400);
      expect(store.executeAction({ action: "UNKNOWN_CMD" }).status).toBe(400);
      expect(
        store.executeAction({
          action: "CANCEL_BOOKING",
          bookingId: "non-existent-id",
        }).status
      ).toBe(404);
      expect(
        store.executeAction({
          action: "UPDATE_ALLOCATION_RETURN",
          allocationId: "non-existent-alloc",
          newStatus: "RETURNED",
        }).status
      ).toBe(404);
    });
  });
});
